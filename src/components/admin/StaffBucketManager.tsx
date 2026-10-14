import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { Order, OrderStatus } from '../../types/store';
import { formatPrice, openWhatsApp, formatWhatsAppStageUpdateMessage } from '../../utils/upi';
import { syncStaffLedgerToGoogleSheet } from '../../utils/googleSheets';
import { exportOrdersToCleanCsv } from '../../utils/csvExport';
import {
  Users,
  Package,
  Clock,
  Truck,
  CheckCircle,
  XCircle,
  AlertOctagon,
  UserCheck,
  UserPlus,
  Edit,
  History,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Search,
  Filter,
  ArrowRight,
  ShieldCheck,
  Layers,
  FileSpreadsheet,
  Download,
  Send,
  X,
  AlertCircle,
  CheckCircle2,
  Crown,
  RotateCcw,
  MapPin,
  Building,
  Phone,
  Mail,
  Copy,
  Check,
} from 'lucide-react';
import { StaffPerformanceBoard } from './StaffPerformanceBoard';

interface StaffBucketManagerProps {
  initialStaffId?: string;
  onNavigateToTab?: (tab: 'orders' | 'staff' | 'products' | 'analytics' | 'settings' | 'customers_issue') => void;
}

export const StaffBucketManager: React.FC<StaffBucketManagerProps> = ({
  initialStaffId,
  onNavigateToTab,
}) => {
  const {
    orders,
    staffMembers,
    currentUser,
    updateOrderStatus,
    updateOrderShipping,
    markRefundProcessed,
    assignOrderStaff,
    addOrderWorkLog,
    closeOrder,
    reopenOrder,
    settings,
    updateSettings,
  } = useStore();

  const isAdmin = currentUser?.type === 'admin';

  // Determine which bucket to open by default:
  // If user is admin, default to 'admin' bucket; if staff, default to their own bucket or first staff
  const defaultBucketId = useMemo(() => {
    if (initialStaffId) return initialStaffId;
    if (isAdmin) return 'admin';
    if (currentUser?.staffId) return currentUser.staffId;
    if (staffMembers.length > 0) return staffMembers[0].id;
    return 'unassigned';
  }, [initialStaffId, isAdmin, currentUser, staffMembers]);

  const [activeBucketStaffId, setActiveBucketStaffId] = useState<string>(defaultBucketId);

  React.useEffect(() => {
    if (initialStaffId) {
      setActiveBucketStaffId(initialStaffId);
    }
  }, [initialStaffId]);

  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [bucketViewMode, setBucketViewMode] = useState<'all' | 'active' | 'closed'>('active');
  const [bucketSearchQuery, setBucketSearchQuery] = useState('');
  const [selectedDetailOrder, setSelectedDetailOrder] = useState<Order | null>(null);

  // Assignment Modal for staff or reassign
  const [assignModalOrder, setAssignModalOrder] = useState<Order | null>(null);
  const [targetStaffId, setTargetStaffId] = useState('');
  const [assignmentReason, setAssignmentReason] = useState('');

  // Mandatory assignment prompt modal before stage changes (User Request 5 & Confirmed Choice)
  const [mandatoryAssignPromptOrder, setMandatoryAssignPromptOrder] = useState<{
    order: Order;
    intendedStatus?: OrderStatus;
  } | null>(null);

  // Reopen Order modal with mandatory reason (User Request 5 & Plan)
  const [reopenModalOrder, setReopenModalOrder] = useState<Order | null>(null);
  const [reopenReasonText, setReopenReasonText] = useState('');

  // Performance Leaderboard toggle (User Request: analyze staff efforts and appreciate)
  const [showPerformanceLeaderboard, setShowPerformanceLeaderboard] = useState(false);

  // Work note modal
  const [workNoteModalOrder, setWorkNoteModalOrder] = useState<Order | null>(null);
  const [workNoteText, setWorkNoteText] = useState('');

  // Shipping details modal when 'Shipped' is chosen (User Request)
  const [shippingModalOrder, setShippingModalOrder] = useState<Order | null>(null);
  const [courierName, setCourierName] = useState('DTDC Express');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [shippingNotes, setShippingNotes] = useState('');

  // Cancellation and Refund modal when 'Cancelled' or 'Rejected' is chosen (User Request)
  const [cancellationModalOrder, setCancellationModalOrder] = useState<{
    order: Order;
    targetStatus: 'Cancelled' | 'Rejected';
  } | null>(null);
  const [cancellationReasonPreset, setCancellationReasonPreset] = useState('Weaver Loom Backlog / Out of Stock');
  const [cancellationReasonCustom, setCancellationReasonCustom] = useState('');
  const [refundUtr, setRefundUtr] = useState('');
  const [refundNotes, setRefundNotes] = useState('');

  // Google Sheets sync & CSV export for staff bucket (User Request)
  const [isSyncingSheets, setIsSyncingSheets] = useState(false);
  const [sheetSyncSuccess, setSheetSyncSuccess] = useState<{ url: string; count: number } | null>(null);
  const [sheetSyncError, setSheetSyncError] = useState<string | null>(null);
  const [showOnlyDisputes, setShowOnlyDisputes] = useState(false);

  // Active bucket flags
  const isViewingAdmin = activeBucketStaffId === 'admin';
  const isViewingUnassigned = activeBucketStaffId === 'unassigned';
  const isViewingMyOwnBucket =
    (currentUser?.staffId && currentUser.staffId === activeBucketStaffId) ||
    (isAdmin && isViewingAdmin);

  // Active staff details
  const activeStaff = staffMembers.find((s) => s.id === activeBucketStaffId);

  // Total counts for quick selector
  const adminOrdersCount = useMemo(() => orders.filter((o) => o.assignedStaffId === 'admin').length, [orders]);
  const unassignedOrdersCount = useMemo(() => orders.filter((o) => !o.assignedStaffId || o.assignedStaffId === 'unassigned').length, [orders]);

  // Orders for current bucket
  const bucketOrders = useMemo(() => {
    return orders.filter((o) => {
      if (isViewingUnassigned) {
        return !o.assignedStaffId || o.assignedStaffId === 'unassigned';
      }
      if (isViewingAdmin) {
        return o.assignedStaffId === 'admin';
      }
      return o.assignedStaffId === activeBucketStaffId;
    });
  }, [orders, activeBucketStaffId, isViewingUnassigned, isViewingAdmin]);

  const activeOrdersCount = useMemo(() => bucketOrders.filter((o) => !o.isClosed).length, [bucketOrders]);
  const closedOrdersCount = useMemo(() => bucketOrders.filter((o) => o.isClosed).length, [bucketOrders]);

  // Filtered bucket orders
  const filteredBucketOrders = useMemo(() => {
    return bucketOrders.filter((o) => {
      // Disputed orders filter (from clicking Customers Issue card)
      if (showOnlyDisputes && !o.deliveryIssue?.reported) return false;

      // Filter by bucketViewMode ('active' vs 'closed')
      if (bucketViewMode === 'closed' && !o.isClosed) return false;
      if (bucketViewMode === 'active' && o.isClosed) return false;

      const matchStatus = selectedStatusFilter === 'all' || o.status === selectedStatusFilter;
      const q = bucketSearchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        o.orderNumber.toLowerCase().includes(q) ||
        o.customer.name.toLowerCase().includes(q) ||
        o.customer.phone.includes(q) ||
        o.items.some((it) => it.product.title.toLowerCase().includes(q) || it.product.productCode.toLowerCase().includes(q));
      return matchStatus && matchQuery;
    });
  }, [bucketOrders, bucketViewMode, selectedStatusFilter, bucketSearchQuery, showOnlyDisputes]);

  // Metrics for active bucket
  const bucketMetrics = useMemo(() => {
    const total = bucketOrders.length;
    const pending = bucketOrders.filter((o) => o.status === 'Pending').length;
    const confirmed = bucketOrders.filter((o) => o.status === 'Confirmed').length;
    const shipped = bucketOrders.filter((o) => o.status === 'Shipped').length;
    const delivered = bucketOrders.filter((o) => o.status === 'Delivered').length;
    const customerIssues = bucketOrders.filter((o) => o.deliveryIssue?.reported).length;
    const closed = bucketOrders.filter((o) => o.isClosed).length;
    const totalValue = bucketOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    return { total, pending, confirmed, shipped, delivered, customerIssues, closed, totalValue };
  }, [bucketOrders]);

  // Staff Performance Breakdown for Whole Store Analytics & Appreciation (User Request)
  const staffPerformanceList = useMemo(() => {
    interface StaffPerformanceMetric {
      id: string;
      name: string;
      username: string;
      role: string;
      total: number;
      delivered: number;
      closed: number;
      totalAmount: number;
    }

    const list: StaffPerformanceMetric[] = staffMembers.map((staff) => {
      const staffOrders = orders.filter((o) => o.assignedStaffId === staff.id);
      const delivered = staffOrders.filter((o) => o.status === 'Delivered').length;
      const closed = staffOrders.filter((o) => o.isClosed).length;
      const totalAmount = staffOrders.reduce((sum, o) => sum + o.totalAmount, 0);
      return {
        id: staff.id,
        name: staff.name,
        username: staff.username,
        role: staff.role,
        total: staffOrders.length,
        delivered,
        closed,
        totalAmount,
      };
    });

    const adminOrders = orders.filter((o) => o.assignedStaffId === 'admin');
    const adminDelivered = adminOrders.filter((o) => o.status === 'Delivered').length;
    const adminClosed = adminOrders.filter((o) => o.isClosed).length;
    const adminTotalAmount = adminOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    list.unshift({
      id: 'admin',
      name: 'Store Owner',
      username: 'admin',
      role: 'Store Owner / Admin',
      total: adminOrders.length,
      delivered: adminDelivered,
      closed: adminClosed,
      totalAmount: adminTotalAmount,
    });

    return list.sort((a, b) => b.total - a.total);
  }, [orders, staffMembers]);

  // Handle stage change with mandatory assignment check & popups (User Request 2 & 5)
  const handleStageChange = (order: Order, newStatus: OrderStatus) => {
    // User Requirement 5: Order MUST be assigned before changing stages and working on it
    if (!order.assignedStaffId || order.assignedStaffId === 'unassigned') {
      setMandatoryAssignPromptOrder({ order, intendedStatus: newStatus });
      return;
    }

    // User Requirement 2: Open shipping details popup when 'Shipped' is chosen
    if (newStatus === 'Shipped') {
      setShippingModalOrder(order);
      setCourierName(order.shippingDetails?.courierName || 'DTDC Express');
      setTrackingNumber(order.shippingDetails?.trackingNumber || '');
      setShippingNotes(order.shippingDetails?.notes || '');
      return;
    }

    // User Requirement 2: Open cancellation & refund popup when 'Cancelled' or 'Rejected' is chosen
    if (newStatus === 'Cancelled' || newStatus === 'Rejected') {
      setCancellationModalOrder({ order, targetStatus: newStatus });
      setCancellationReasonPreset('Weaver Loom Backlog / Out of Stock');
      setCancellationReasonCustom('');
      setRefundUtr(order.refundDetails?.refundUtr || '');
      setRefundNotes(order.refundDetails?.notes || '');
      return;
    }

    updateOrderStatus(order.id, newStatus);
    if (selectedDetailOrder?.id === order.id) {
      setSelectedDetailOrder((prev) => (prev ? { ...prev, status: newStatus } : null));
    }
  };

  const handleSendShippingWhatsApp = (
    order: Order,
    courier: string,
    trackNum: string,
    notes?: string
  ) => {
    const cleanPhone = order.customer.phone.replace(/[^0-9]/g, '');
    const notesLine = notes ? `\n📝 Dispatch Note: ${notes}` : '';
    const msg = `Namaste ${order.customer.name}! 🪔✨\n\nYour luxury handloom saree order #${order.orderNumber} from *${settings.boutiqueName}* has been dispatched!\n\n🚚 *Courier Partner:* ${courier}\n📦 *Tracking / Consignment ID:* ${trackNum}${notesLine}\n\nYou can track your shipment live on our boutique tracking portal.\n\nThank you for choosing ${settings.boutiqueName}!`;
    openWhatsApp(cleanPhone, msg);
  };

  const handleSaveShipping = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!shippingModalOrder || !trackingNumber.trim()) return;

    const courier = courierName.trim();
    const trackNum = trackingNumber.trim().toUpperCase();
    const notes = shippingNotes.trim();

    updateOrderShipping(shippingModalOrder.id, {
      courierName: courier,
      trackingNumber: trackNum,
      notes,
    });

    updateOrderStatus(shippingModalOrder.id, 'Shipped');

    if (selectedDetailOrder?.id === shippingModalOrder.id) {
      setSelectedDetailOrder((prev) =>
        prev
          ? {
              ...prev,
              status: 'Shipped',
              shippingDetails: {
                courierName: courier,
                trackingNumber: trackNum,
                notes,
              },
            }
          : null
      );
    }

    setShippingModalOrder(null);
  };

  const handleSaveCancellation = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!cancellationModalOrder) return;

    const finalReason =
      cancellationReasonPreset === 'Other Reason'
        ? cancellationReasonCustom.trim() || 'Cancelled by boutique concierge'
        : cancellationReasonPreset +
          (cancellationReasonCustom.trim() ? ` - ${cancellationReasonCustom.trim()}` : '');

    const { order, targetStatus } = cancellationModalOrder;

    updateOrderStatus(order.id, targetStatus, {
      cancellationReason: finalReason,
    });

    if (refundUtr.trim()) {
      markRefundProcessed(order.id, refundUtr.trim(), refundNotes.trim());
    }

    if (selectedDetailOrder?.id === order.id) {
      setSelectedDetailOrder((prev) =>
        prev
          ? {
              ...prev,
              status: targetStatus,
              cancellationReason: finalReason,
              refundDetails: {
                ...prev.refundDetails,
                refundStatus: refundUtr.trim() ? 'processed' : 'pending',
                refundUtr: refundUtr.trim() || prev.refundDetails?.refundUtr,
                notes: refundNotes.trim() || prev.refundDetails?.notes,
              },
            }
          : null
      );
    }

    setCancellationModalOrder(null);
  };

  // Quick 1-Click "Assign to Me" handler (User Request 4)
  const handleAssignToMe = (order: Order) => {
    const myId = currentUser?.staffId || (isAdmin ? 'admin' : '');
    const myName = currentUser?.name || (isAdmin ? 'Store Owner' : 'Staff Concierge');
    if (!myId) return;

    const claimReason = isAdmin
      ? 'Claimed by Store Owner'
      : `Claimed by staff concierge (${myName})`;

    assignOrderStaff(order.id, myId, myName, claimReason);
    if (selectedDetailOrder?.id === order.id) {
      setSelectedDetailOrder((prev) =>
        prev ? { ...prev, assignedStaffId: myId, assignedStaffName: myName } : null
      );
    }
  };

  // One-click claim and continue stage for unassigned orders (User Request 5 & Confirmed Choice)
  const handleClaimAndContinueStage = () => {
    if (!mandatoryAssignPromptOrder) return;
    const { order, intendedStatus } = mandatoryAssignPromptOrder;
    const myId = currentUser?.staffId || (isAdmin ? 'admin' : '');
    const myName = currentUser?.name || (isAdmin ? 'Store Owner' : 'Staff Concierge');
    const claimReason = isAdmin
      ? 'Claimed by Store Owner to process stage'
      : `Claimed by ${myName} to transition order stage`;

    if (myId) {
      assignOrderStaff(order.id, myId, myName, claimReason);
      const updatedOrder: Order = {
        ...order,
        assignedStaffId: myId,
        assignedStaffName: myName,
      };

      if (selectedDetailOrder?.id === order.id) {
        setSelectedDetailOrder((prev) =>
          prev ? { ...prev, assignedStaffId: myId, assignedStaffName: myName } : null
        );
      }

      setMandatoryAssignPromptOrder(null);

      if (intendedStatus) {
        handleStageChange(updatedOrder, intendedStatus);
      }
    } else {
      setMandatoryAssignPromptOrder(null);
      setAssignModalOrder(order);
      setTargetStaffId(staffMembers[0]?.id || 'admin');
      setAssignmentReason('Assigned to start work');
    }
  };

  const handleConfirmAssignment = () => {
    if (!assignModalOrder) return;
    if (!targetStaffId) {
      return;
    }
    // Staff must state a reason, admin does not have to
    if (!isAdmin && !assignmentReason.trim()) {
      return;
    }
    const targetStaff = staffMembers.find((s) => s.id === targetStaffId);
    const targetName =
      targetStaffId === 'admin' ? 'Store Owner' : targetStaff?.name || 'Staff Member';
    const finalReason =
      assignmentReason.trim() || (isAdmin ? 'Assigned by Store Owner' : 'Assigned to staff');

    assignOrderStaff(assignModalOrder.id, targetStaffId, targetName, finalReason);

    if (selectedDetailOrder?.id === assignModalOrder.id) {
      setSelectedDetailOrder((prev) =>
        prev
          ? { ...prev, assignedStaffId: targetStaffId, assignedStaffName: targetName }
          : null
      );
    }

    setAssignModalOrder(null);
  };

  const handleAddWorkNote = () => {
    if (!workNoteModalOrder || !workNoteText.trim()) return;
    const isOtherStaff = workNoteModalOrder.assignedStaffId && workNoteModalOrder.assignedStaffId !== currentUser?.staffId;
    const notePrefix = isOtherStaff ? `[Note by @${currentUser?.username || 'colleague'}] ` : '';
    addOrderWorkLog(workNoteModalOrder.id, 'Staff Progress Note', `${notePrefix}${workNoteText.trim()}`);
    setWorkNoteModalOrder(null);
    setWorkNoteText('');
  };

  // Universal CSV exporter for individual bucket or whole store (RFC 4180 aligned)
  const exportOrdersListToCsv = (ordersList: Order[], fileSuffix: string) => {
    exportOrdersToCleanCsv(ordersList, fileSuffix);
  };

  // Google Sheets sync for active bucket
  const handleSyncBucketSheets = async () => {
    setIsSyncingSheets(true);
    setSheetSyncSuccess(null);
    setSheetSyncError(null);
    try {
      const targetSpreadsheetId =
        settings.ordersSpreadsheetId || settings.analyticsSpreadsheetId;
      const res = await syncStaffLedgerToGoogleSheet(
        bucketOrders,
        staffMembers,
        settings.boutiqueName,
        targetSpreadsheetId
      );
      if (res.success) {
        setSheetSyncSuccess({ url: res.spreadsheetUrl, count: res.rowsUpdated });
        updateSettings({
          ordersSpreadsheetId: res.spreadsheetId,
          ordersSpreadsheetUrl: res.spreadsheetUrl,
        });
      }
    } catch (err: any) {
      setSheetSyncError(err?.message || 'Failed to sync bucket with Google Sheets');
    } finally {
      setIsSyncingSheets(false);
    }
  };

  // Google Sheets sync for all staff & admin combined (Whole Store)
  const handleSyncWholeStoreSheets = async () => {
    setIsSyncingSheets(true);
    setSheetSyncSuccess(null);
    setSheetSyncError(null);
    try {
      const targetSpreadsheetId =
        settings.ordersSpreadsheetId || settings.analyticsSpreadsheetId;
      const res = await syncStaffLedgerToGoogleSheet(
        orders,
        staffMembers,
        settings.boutiqueName,
        targetSpreadsheetId
      );
      if (res.success) {
        setSheetSyncSuccess({ url: res.spreadsheetUrl, count: res.rowsUpdated });
        updateSettings({
          ordersSpreadsheetId: res.spreadsheetId,
          ordersSpreadsheetUrl: res.spreadsheetUrl,
        });
      }
    } catch (err: any) {
      setSheetSyncError(err?.message || 'Failed to sync whole store with Google Sheets');
    } finally {
      setIsSyncingSheets(false);
    }
  };

  // Export CSV for active bucket
  const handleExportBucketCsv = () => {
    const bucketLabel = isViewingAdmin ? 'admin_owner' : isViewingUnassigned ? 'unassigned' : activeStaff?.username || 'staff';
    exportOrdersListToCsv(bucketOrders, `bucket_${bucketLabel}`);
  };

  // Export CSV for all staff & admin combined (Whole Store)
  const handleExportWholeStoreCsv = () => {
    exportOrdersListToCsv(orders, 'all_staff_and_admin_whole_store');
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-neutral-900 via-neutral-950 to-neutral-900 rounded-3xl p-5 sm:p-6 text-white shadow-xl border border-neutral-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                <Layers className="w-3 h-3" />
                <span>Dedicated Staff Orders Column</span>
              </span>
              {isViewingMyOwnBucket && (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                  ★ Your Active Bucket
                </span>
              )}
            </div>
            <h2 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>Staff Orders Bucket:</span>
              <span className="text-amber-400">
                {isViewingUnassigned
                  ? 'Unassigned Intake Queue'
                  : isViewingAdmin
                  ? 'Store Owner / Admin Bucket'
                  : activeStaff
                  ? `${activeStaff.name} (@${activeStaff.username})`
                  : 'Staff Bucket'}
              </span>
            </h2>
            <p className="text-xs text-neutral-400 mt-1 max-w-2xl leading-relaxed">
              Each staff member can handle their assigned orders separately. Other staff and admins can also view any staff's bucket, assist with work, or reassign orders — every single action is recorded live in the work ledger.
            </p>
          </div>

          {/* Quick Actions & Sync: Whole Store & Bucket Options (User Request) */}
          <div className="flex items-center gap-2 flex-wrap self-start md:self-auto">
            {/* Whole Store Sync & Export */}
            <div className="flex items-center gap-1.5 p-1 bg-neutral-900/90 rounded-2xl border border-neutral-700/80 shadow-xs">
              <button
                type="button"
                onClick={handleSyncWholeStoreSheets}
                disabled={isSyncingSheets}
                className="px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs cursor-pointer disabled:opacity-50"
                title="Sync All Staff & Admin Orders (Whole Store) to Google Sheets"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-200" />
                <span>{isSyncingSheets ? 'Syncing...' : 'Sync Whole Store'}</span>
              </button>

              <button
                type="button"
                onClick={handleExportWholeStoreCsv}
                className="px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 cursor-pointer"
                title="Download CSV for all staff and admin to evaluate performance"
              >
                <Download className="w-3.5 h-3.5 text-neutral-300" />
                <span>All Staff CSV</span>
              </button>
            </div>

            {/* Individual Bucket Sync & Export */}
            <div className="flex items-center gap-1.5 p-1 bg-neutral-900/90 rounded-2xl border border-neutral-700/80 shadow-xs">
              <button
                type="button"
                onClick={handleSyncBucketSheets}
                disabled={isSyncingSheets}
                className="px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 cursor-pointer disabled:opacity-50"
                title="Sync only this bucket's orders to Google Sheets"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-amber-300" />
                <span>Sync Bucket</span>
              </button>

              <button
                type="button"
                onClick={handleExportBucketCsv}
                className="px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 cursor-pointer"
                title="Download CSV for this bucket only"
              >
                <Download className="w-3.5 h-3.5 text-neutral-300" />
                <span>Bucket CSV</span>
              </button>
            </div>

            {/* Open Sheets Option (User Request 2) */}
            {(settings.ordersSpreadsheetUrl || settings.analyticsSpreadsheetUrl) && (
              <a
                href={settings.ordersSpreadsheetUrl || settings.analyticsSpreadsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 sm:px-3 py-1.5 rounded-2xl text-xs font-semibold transition flex items-center gap-1.5 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/50 shadow-xs cursor-pointer"
                title="Open Master Google Sheets Ledger in a new browser tab"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>Open Sheets</span>
                <ExternalLink className="w-3 h-3 text-emerald-300" />
              </a>
            )}

            {/* Staff Performance & Appreciation Ledger Button (User Request) */}
            <button
              type="button"
              onClick={() => setShowPerformanceLeaderboard(!showPerformanceLeaderboard)}
              className={`px-3 py-1.5 rounded-2xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer border shadow-xs ${
                showPerformanceLeaderboard
                  ? 'bg-amber-400 text-neutral-950 border-amber-300 font-bold'
                  : 'bg-neutral-900/90 hover:bg-neutral-800 text-amber-300 border-neutral-700/80'
              }`}
              title="Analyze which staff works a lot of orders and appreciate their efforts"
            >
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              <span>{showPerformanceLeaderboard ? 'Close Staff Overview' : 'Staff Effort & Performance'}</span>
            </button>
          </div>
        </div>

        {/* Bucket Selector Pills Strip: Wrapping Multi-Line View (User Request: wrap below first line without scrolling) */}
        <div className="mt-5 pt-4 border-t border-neutral-800/80 flex flex-wrap items-center gap-2 pb-1">
          <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mr-1">
            Switch Bucket:
          </span>

          {/* Admin Bucket Pill */}
          <button
            type="button"
            onClick={() => setActiveBucketStaffId('admin')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-2 cursor-pointer border ${
              activeBucketStaffId === 'admin'
                ? 'bg-amber-400 text-neutral-950 border-amber-300 shadow-sm font-bold ring-1 ring-amber-300'
                : 'bg-neutral-900/90 hover:bg-neutral-800 text-amber-300 border-amber-900/60'
            }`}
            title="Orders assigned to Store Owner / Admin"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
            <span>Admin Bucket</span>
            {isAdmin && <span className="text-[10px] text-amber-900 font-bold">(You)</span>}
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeBucketStaffId === 'admin' ? 'bg-neutral-950 text-white' : 'bg-neutral-800 text-amber-300'
              }`}
            >
              {adminOrdersCount}
            </span>
          </button>

          {/* Unassigned Intake Queue Pill */}
          <button
            type="button"
            onClick={() => setActiveBucketStaffId('unassigned')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-2 cursor-pointer border ${
              activeBucketStaffId === 'unassigned'
                ? 'bg-rose-500 text-white border-rose-400 shadow-sm font-bold'
                : 'bg-neutral-900/90 hover:bg-neutral-800 text-neutral-300 border-neutral-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-rose-400" />
            <span>Unassigned Queue</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeBucketStaffId === 'unassigned' ? 'bg-neutral-950 text-white' : 'bg-neutral-800 text-neutral-300'
              }`}
            >
              {unassignedOrdersCount}
            </span>
          </button>

          {/* Staff Members Pills */}
          {staffMembers.map((staff) => {
            const count = orders.filter((o) => o.assignedStaffId === staff.id).length;
            const isSelected = activeBucketStaffId === staff.id;
            const isMe = currentUser?.staffId === staff.id;

            return (
              <button
                key={staff.id}
                type="button"
                onClick={() => setActiveBucketStaffId(staff.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-2 cursor-pointer border ${
                  isSelected
                    ? 'bg-white text-neutral-950 border-white shadow-sm font-bold'
                    : 'bg-neutral-900/90 hover:bg-neutral-800 text-neutral-300 border-neutral-800'
                }`}
              >
                <span className="w-5 h-5 rounded-full bg-gradient-to-tr from-amber-600 to-rose-700 text-white text-[10px] font-serif font-bold flex items-center justify-center shrink-0">
                  {staff.name.charAt(0)}
                </span>
                <span>{staff.name}</span>
                {isMe && <span className="text-[10px] text-amber-600 font-bold">(You)</span>}
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected ? 'bg-neutral-950 text-white' : 'bg-neutral-800 text-neutral-300'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Google Sheets Sync Success or Error Banner */}
      {sheetSyncSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs flex items-center justify-between gap-3 flex-wrap shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Synced <strong>{sheetSyncSuccess.count}</strong> bucket orders to Google Sheets!
            </span>
          </div>
          {sheetSyncSuccess.url && (
            <a
              href={sheetSyncSuccess.url}
              target="_blank"
              rel="noreferrer"
              className="font-bold underline text-emerald-700 hover:text-emerald-900 inline-flex items-center gap-1"
            >
              <span>Open Google Sheet</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}
      {sheetSyncError && (
        <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-950 text-xs flex items-center justify-between gap-2">
          <span>Failed to sync with Google Sheets: {sheetSyncError}</span>
          <button
            type="button"
            onClick={() => setSheetSyncError(null)}
            className="text-rose-700 font-bold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Staff Performance & Appreciation Overview Panel (User Request: Fastest Closer, Fastest Assigner, Fastest Dispute Resolver) */}
      {showPerformanceLeaderboard && (
        <StaffPerformanceBoard
          onClose={() => setShowPerformanceLeaderboard(false)}
          onSelectStaffBucket={(staffId) => {
            setActiveBucketStaffId(staffId);
            setShowPerformanceLeaderboard(false);
          }}
          onExportCsv={handleExportWholeStoreCsv}
        />
      )}

      {/* Metrics Row for Selected Bucket: 6 Interactive Clickable Metric Cards (User Request 8) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 1. Total in Bucket */}
        <button
          type="button"
          onClick={() => {
            setSelectedStatusFilter('all');
            setBucketViewMode('active');
            setShowOnlyDisputes(false);
          }}
          className={`p-3.5 rounded-2xl border text-left transition cursor-pointer shadow-2xs group ${
            selectedStatusFilter === 'all' && !showOnlyDisputes
              ? 'bg-neutral-900 text-white border-neutral-900 ring-2 ring-neutral-900 shadow-sm'
              : 'bg-white hover:bg-neutral-50/80 border-neutral-200/90 text-neutral-900 hover:border-neutral-300'
          }`}
          title="Click to view all active orders in this bucket"
        >
          <span
            className={`text-[10px] font-bold uppercase tracking-wider block ${
              selectedStatusFilter === 'all' && !showOnlyDisputes ? 'text-neutral-400' : 'text-neutral-500'
            }`}
          >
            Total in Bucket
          </span>
          <p
            className={`font-serif text-2xl font-bold mt-0.5 ${
              selectedStatusFilter === 'all' && !showOnlyDisputes ? 'text-amber-300' : 'text-neutral-950'
            }`}
          >
            {bucketMetrics.total}
          </p>
          <span
            className={`text-[11px] font-semibold ${
              selectedStatusFilter === 'all' && !showOnlyDisputes ? 'text-neutral-300' : 'text-neutral-500'
            }`}
          >
            {formatPrice(bucketMetrics.totalValue)}
          </span>
        </button>

        {/* 2. Pending */}
        <button
          type="button"
          onClick={() => {
            setSelectedStatusFilter('Pending');
            setBucketViewMode('active');
            setShowOnlyDisputes(false);
          }}
          className={`p-3.5 rounded-2xl border text-left transition cursor-pointer shadow-2xs group ${
            selectedStatusFilter === 'Pending' && !showOnlyDisputes
              ? 'bg-amber-500 text-neutral-950 border-amber-500 ring-2 ring-amber-400 font-bold shadow-sm'
              : 'bg-white hover:bg-amber-50/40 border-amber-200 bg-amber-50/20 text-neutral-900 hover:border-amber-300'
          }`}
          title="Click to filter Pending orders"
        >
          <span
            className={`text-[10px] font-bold uppercase tracking-wider block ${
              selectedStatusFilter === 'Pending' && !showOnlyDisputes ? 'text-neutral-950 font-extrabold' : 'text-amber-800'
            }`}
          >
            Pending
          </span>
          <p
            className={`font-serif text-2xl font-bold mt-0.5 ${
              selectedStatusFilter === 'Pending' && !showOnlyDisputes ? 'text-neutral-950' : 'text-amber-700'
            }`}
          >
            {bucketMetrics.pending}
          </p>
          <span
            className={`text-[10px] ${
              selectedStatusFilter === 'Pending' && !showOnlyDisputes ? 'text-neutral-900 font-medium' : 'text-neutral-500'
            }`}
          >
            Intake / verify
          </span>
        </button>

        {/* 3. Confirmed */}
        <button
          type="button"
          onClick={() => {
            setSelectedStatusFilter('Confirmed');
            setBucketViewMode('active');
            setShowOnlyDisputes(false);
          }}
          className={`p-3.5 rounded-2xl border text-left transition cursor-pointer shadow-2xs group ${
            selectedStatusFilter === 'Confirmed' && !showOnlyDisputes
              ? 'bg-purple-700 text-white border-purple-700 ring-2 ring-purple-500 font-bold shadow-sm'
              : 'bg-white hover:bg-purple-50/40 border-purple-200 bg-purple-50/20 text-neutral-900 hover:border-purple-300'
          }`}
          title="Click to filter Confirmed orders"
        >
          <span
            className={`text-[10px] font-bold uppercase tracking-wider block ${
              selectedStatusFilter === 'Confirmed' && !showOnlyDisputes ? 'text-purple-200' : 'text-purple-800'
            }`}
          >
            Confirmed
          </span>
          <p
            className={`font-serif text-2xl font-bold mt-0.5 ${
              selectedStatusFilter === 'Confirmed' && !showOnlyDisputes ? 'text-white' : 'text-purple-700'
            }`}
          >
            {bucketMetrics.confirmed}
          </p>
          <span
            className={`text-[10px] ${
              selectedStatusFilter === 'Confirmed' && !showOnlyDisputes ? 'text-purple-200' : 'text-neutral-500'
            }`}
          >
            Loom reserving
          </span>
        </button>

        {/* 4. Shipped */}
        <button
          type="button"
          onClick={() => {
            setSelectedStatusFilter('Shipped');
            setBucketViewMode('active');
            setShowOnlyDisputes(false);
          }}
          className={`p-3.5 rounded-2xl border text-left transition cursor-pointer shadow-2xs group ${
            selectedStatusFilter === 'Shipped' && !showOnlyDisputes
              ? 'bg-blue-600 text-white border-blue-600 ring-2 ring-blue-400 font-bold shadow-sm'
              : 'bg-white hover:bg-blue-50/40 border-blue-200 bg-blue-50/20 text-neutral-900 hover:border-blue-300'
          }`}
          title="Click to filter Shipped orders"
        >
          <span
            className={`text-[10px] font-bold uppercase tracking-wider block ${
              selectedStatusFilter === 'Shipped' && !showOnlyDisputes ? 'text-blue-200' : 'text-blue-800'
            }`}
          >
            Shipped
          </span>
          <p
            className={`font-serif text-2xl font-bold mt-0.5 ${
              selectedStatusFilter === 'Shipped' && !showOnlyDisputes ? 'text-white' : 'text-blue-700'
            }`}
          >
            {bucketMetrics.shipped}
          </p>
          <span
            className={`text-[10px] ${
              selectedStatusFilter === 'Shipped' && !showOnlyDisputes ? 'text-blue-200' : 'text-neutral-500'
            }`}
          >
            In courier transit
          </span>
        </button>

        {/* 5. Delivered */}
        <button
          type="button"
          onClick={() => {
            setSelectedStatusFilter('Delivered');
            setBucketViewMode('all');
            setShowOnlyDisputes(false);
          }}
          className={`p-3.5 rounded-2xl border text-left transition cursor-pointer shadow-2xs group ${
            selectedStatusFilter === 'Delivered' && !showOnlyDisputes
              ? 'bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-400 font-bold shadow-sm'
              : 'bg-white hover:bg-emerald-50/40 border-emerald-200 bg-emerald-50/20 text-neutral-900 hover:border-emerald-300'
          }`}
          title="Click to filter Delivered orders"
        >
          <span
            className={`text-[10px] font-bold uppercase tracking-wider block ${
              selectedStatusFilter === 'Delivered' && !showOnlyDisputes ? 'text-emerald-200' : 'text-emerald-800'
            }`}
          >
            Delivered
          </span>
          <p
            className={`font-serif text-2xl font-bold mt-0.5 ${
              selectedStatusFilter === 'Delivered' && !showOnlyDisputes ? 'text-white' : 'text-emerald-700'
            }`}
          >
            {bucketMetrics.delivered}
          </p>
          <span
            className={`text-[10px] ${
              selectedStatusFilter === 'Delivered' && !showOnlyDisputes ? 'text-emerald-200' : 'text-neutral-500'
            }`}
          >
            Closed deal ✓
          </span>
        </button>

        {/* 6. Customers Issue */}
        <button
          type="button"
          onClick={() => {
            if (onNavigateToTab) {
              onNavigateToTab('customers_issue');
            } else {
              setShowOnlyDisputes(true);
              setSelectedStatusFilter('all');
            }
          }}
          className={`p-3.5 rounded-2xl border text-left transition cursor-pointer shadow-2xs group ${
            showOnlyDisputes
              ? 'bg-rose-600 text-white border-rose-600 ring-2 ring-rose-400 font-bold shadow-sm'
              : 'bg-white hover:bg-rose-50/40 border-rose-200 bg-rose-50/20 text-neutral-900 hover:border-rose-300'
          }`}
          title="Click to view Customers Issue & delivery disputes"
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-[10px] font-bold uppercase tracking-wider block ${
                showOnlyDisputes ? 'text-rose-200' : 'text-rose-800'
              }`}
            >
              Customers Issue
            </span>
            {bucketMetrics.customerIssues > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            )}
          </div>
          <p
            className={`font-serif text-2xl font-bold mt-0.5 ${
              showOnlyDisputes ? 'text-white' : 'text-rose-700'
            }`}
          >
            {bucketMetrics.customerIssues}
          </p>
          <span
            className={`text-[10px] ${
              showOnlyDisputes ? 'text-rose-200' : 'text-neutral-500'
            }`}
          >
            {bucketMetrics.customerIssues === 0 ? 'Zero disputes' : `${bucketMetrics.customerIssues} non-delivery`}
          </span>
        </button>
      </div>

      {/* Filter and Search Bar for Bucket */}
      <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Active vs Closed Queue Toggles & Status Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Active vs Closed toggle (User Request 5 & Clarification Answer) */}
          <div className="flex items-center p-1 bg-neutral-100 rounded-xl border border-neutral-200/80">
            <button
              type="button"
              onClick={() => setBucketViewMode('active')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                bucketViewMode === 'active'
                  ? 'bg-neutral-900 text-white shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Active Queue ({activeOrdersCount})
            </button>
            <button
              type="button"
              onClick={() => setBucketViewMode('closed')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                bucketViewMode === 'closed'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Closed Orders ({closedOrdersCount})</span>
            </button>
          </div>

          {/* Status Pills */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {(['all', 'Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setSelectedStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  selectedStatusFilter === st
                    ? 'bg-neutral-950 text-white shadow-xs'
                    : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-600'
                }`}
              >
                {st === 'all' ? 'All Stages' : st}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={bucketSearchQuery}
            onChange={(e) => setBucketSearchQuery(e.target.value)}
            placeholder="Search bucket orders..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-neutral-300 text-xs focus:ring-2 focus:ring-amber-500/40 focus:outline-hidden"
          />
        </div>
      </div>

      {/* Bucket Orders List */}
      {filteredBucketOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center">
          <Package className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
          <p className="font-serif text-lg font-bold text-neutral-800">
            No orders found in this staff bucket
          </p>
          <p className="text-xs text-neutral-500 mt-1 max-w-md mx-auto">
            {isViewingUnassigned
              ? 'All incoming orders have been claimed by concierge staff.'
              : `Assign orders to ${activeStaff?.name || 'this staff member'} from the main Orders tab or Unassigned Queue to start handling.`}
          </p>
          {isViewingUnassigned && (
            <button
              type="button"
              onClick={() => onNavigateToTab?.('orders')}
              className="mt-4 px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold transition"
            >
              Browse All Boutique Orders
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBucketOrders.map((order) => {
            const isAssignedToMe =
              (currentUser?.staffId && currentUser.staffId === order.assignedStaffId) ||
              (isAdmin && order.assignedStaffId === 'admin');
            const lastLog = order.assignmentHistory?.[order.assignmentHistory.length - 1];

            return (
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-neutral-200 p-4.5 shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-3"
              >
                <div>
                  {/* Top Header */}
                  <div className="flex items-center justify-between gap-2 border-b border-neutral-100 pb-2.5">
                    <span className="font-mono text-xs font-bold text-rose-950 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                      #{order.orderNumber}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        order.status === 'Delivered'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : order.status === 'Shipped'
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : order.status === 'Confirmed'
                          ? 'bg-purple-100 text-purple-800 border border-purple-200'
                          : order.status === 'Cancelled'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {order.status}
                    </span>
                  </div>

                  {/* Customer & Amount */}
                  <div className="pt-2">
                    <h4 className="font-bold text-sm text-neutral-900">{order.customer.name}</h4>
                    <p className="text-xs text-neutral-500 font-mono mt-0.5">{order.customer.phone}</p>
                    <p className="text-[11px] text-neutral-600 truncate mt-0.5">
                      {order.customer.city}, {order.customer.state}
                    </p>
                  </div>

                  {/* Saree Items Summary */}
                  <div className="mt-3 p-2.5 bg-neutral-50 rounded-xl border border-neutral-100 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-neutral-600 font-medium">
                        {order.items.length} {order.items.length === 1 ? 'Saree' : 'Sarees'}:
                      </span>
                      <strong className="text-neutral-950 font-bold tabular-nums">
                        {formatPrice(order.totalAmount)}
                      </strong>
                    </div>
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {order.items.map((it) => (
                        <div key={it.product.id} className="text-[11px] text-neutral-700 flex items-center justify-between">
                          <span className="truncate pr-2 font-medium">{it.product.title}</span>
                          <span className="text-[10px] text-neutral-500 shrink-0 font-mono">
                            {it.product.productCode} ×{it.quantity}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Last Live Work Update */}
                  {lastLog && (
                    <div className="mt-2.5 p-2 rounded-lg bg-amber-50/70 border border-amber-200/80 text-[10px]">
                      <span className="font-bold text-amber-900 block truncate">
                        Last Update by {lastLog.staffName}:
                      </span>
                      <p className="text-neutral-700 italic truncate mt-0.5">"{lastLog.action}"</p>
                    </div>
                  )}
                </div>

                {/* Bottom Actions */}
                <div className="pt-2 border-t border-neutral-100 space-y-2">
                  {order.isClosed ? (
                    <div className="p-2 rounded-xl bg-neutral-900 text-white flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-bold">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Closed Order</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setReopenModalOrder(order);
                          setReopenReasonText('');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold text-[10px] transition flex items-center gap-1 cursor-pointer"
                        title="Reopen order with mandatory reason"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Reopen Order</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      {/* Stage Switcher buttons */}
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[10px] font-bold text-neutral-500 mr-0.5">Stage:</span>
                        {(['Pending', 'Confirmed', 'Shipped', 'Delivered'] as OrderStatus[]).map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => handleStageChange(order, st)}
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold transition ${
                              order.status === st
                                ? 'bg-neutral-900 text-white font-bold'
                                : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>

                      {/* If order is Delivered, show Close Order button */}
                      {order.status === 'Delivered' && !order.isClosed && (
                        <button
                          type="button"
                          onClick={() => closeOrder(order.id, currentUser?.name)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer shrink-0"
                          title="Close delivered order and move to Closed Orders view"
                        >
                          <CheckCircle className="w-3 h-3" />
                          <span>Close Order</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Actions Row */}
                  <div className="flex items-center justify-between gap-1.5 pt-1 flex-wrap">
                    {/* View Details Button */}
                    <button
                      type="button"
                      onClick={() => setSelectedDetailOrder(order)}
                      className="px-2.5 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
                    >
                      <span>View Details</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Assign to Me Button (User Request 4) */}
                      {isAssignedToMe ? (
                        <span className="px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Assigned to You</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAssignToMe(order)}
                          className="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer"
                          title="Claim this order to work on it"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Assign to Me</span>
                        </button>
                      )}

                      {/* Work note */}
                      <button
                        type="button"
                        onClick={() => {
                          setWorkNoteModalOrder(order);
                          setWorkNoteText('');
                        }}
                        className="p-1.5 rounded-lg border border-neutral-300 hover:bg-neutral-100 text-neutral-700 transition cursor-pointer"
                        title="Add live work note"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>

                      {/* Reassign / Claim */}
                      <button
                        type="button"
                        onClick={() => {
                          setAssignModalOrder(order);
                          setTargetStaffId(order.assignedStaffId || (staffMembers[0]?.id || ''));
                          setAssignmentReason('');
                        }}
                        className="p-1.5 rounded-lg border border-neutral-300 hover:bg-neutral-100 text-neutral-700 transition cursor-pointer"
                        title="Assign or reassign staff"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detailed Order Modal */}
      {selectedDetailOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 my-auto animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 bg-neutral-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-bold text-amber-300 bg-amber-500/20 px-2.5 py-1 rounded-lg border border-amber-500/30">
                  #{selectedDetailOrder.orderNumber}
                </span>
                <div>
                  <h3 className="font-serif text-base font-bold">
                    {selectedDetailOrder.customer.name}
                  </h3>
                  <p className="text-xs text-neutral-400">
                    Handled in {selectedDetailOrder.assignedStaffName || 'Queue'} Bucket
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetailOrder(null)}
                className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6 text-xs max-h-[80vh] overflow-y-auto">
              {/* Closed Order Status Banner */}
              {selectedDetailOrder.isClosed && (
                <div className="p-3.5 rounded-2xl bg-neutral-900 text-white flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <p className="font-bold text-xs text-white">This order is Closed</p>
                      <p className="text-[10px] text-neutral-400">
                        {selectedDetailOrder.closedAt ? `Closed on ${new Date(selectedDetailOrder.closedAt).toLocaleString('en-IN')}` : ''}
                        {selectedDetailOrder.closedBy ? ` by ${selectedDetailOrder.closedBy}` : ''}
                        {selectedDetailOrder.reopenReason ? ` · Prior reopen reason: "${selectedDetailOrder.reopenReason}"` : ''}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setReopenModalOrder(selectedDetailOrder);
                      setReopenReasonText('');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold text-xs transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reopen Order</span>
                  </button>
                </div>
              )}

              {/* Stage Switcher */}
              <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="font-bold text-neutral-700 text-xs block">Current Order Stage:</span>
                  <p className="text-[11px] text-neutral-500">
                    Select a stage to transition the saree order and notify customer.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'] as OrderStatus[]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => handleStageChange(selectedDetailOrder, st)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                        selectedDetailOrder.status === st
                          ? 'bg-neutral-900 text-white shadow-xs font-bold'
                          : 'bg-white hover:bg-neutral-200 border border-neutral-300 text-neutral-700'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid: Customer + Items */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Customer */}
                <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-2">
                  <h4 className="font-serif font-bold text-neutral-900 text-xs uppercase tracking-wider">
                    Customer Information
                  </h4>
                  <p className="font-bold text-sm text-neutral-900">{selectedDetailOrder.customer.name}</p>
                  <p className="text-neutral-600">Phone: {selectedDetailOrder.customer.phone}</p>
                  <p className="text-neutral-600">Email: {selectedDetailOrder.customer.email}</p>
                  <p className="text-neutral-700 leading-relaxed pt-1 border-t border-neutral-200">
                    {selectedDetailOrder.customer.address}, {selectedDetailOrder.customer.city}, {selectedDetailOrder.customer.state} - {selectedDetailOrder.customer.pincode}
                  </p>
                </div>

                {/* Saree Items */}
                <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-2">
                  <h4 className="font-serif font-bold text-neutral-900 text-xs uppercase tracking-wider flex items-center justify-between">
                    <span>Ordered Sarees ({selectedDetailOrder.items.length})</span>
                    <span className="text-neutral-900 font-bold">{formatPrice(selectedDetailOrder.totalAmount)}</span>
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {selectedDetailOrder.items.map((item) => (
                      <div
                        key={item.product.id}
                        className="flex items-center gap-2.5 p-2 rounded-xl bg-white border border-neutral-200"
                      >
                        <img
                          src={item.product.images[0] || '/src/assets/images/hero_saree_atelier_1791651761357.jpg'}
                          alt={item.product.title}
                          className="w-10 h-12 object-cover rounded-md bg-neutral-100 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-neutral-900 truncate">{item.product.title}</p>
                          <p className="text-[10px] text-neutral-500 font-mono">
                            SKU: {item.product.productCode} · Qty: {item.quantity}
                          </p>
                          <p className="text-[10px] text-neutral-500">{item.product.fabric}</p>
                        </div>
                        <span className="font-bold text-neutral-900 tabular-nums">
                          {formatPrice(item.product.price * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Courier Partner & Local Hub Details (User Request 6) */}
              {selectedDetailOrder.shippingDetails && (
                (() => {
                  const matchedCourier = (settings.courierServices || []).find(
                    (c) => c.name.toLowerCase().trim() === selectedDetailOrder.shippingDetails?.courierName.toLowerCase().trim()
                  );
                  return (
                    <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <h4 className="font-serif font-bold text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                          <Truck className="w-4 h-4 text-amber-700" />
                          <span>Courier Consignment & Hub Details</span>
                        </h4>
                        <span className="font-mono font-bold bg-white px-2 py-0.5 rounded-md border border-amber-300 text-neutral-900">
                          {selectedDetailOrder.shippingDetails.trackingNumber}
                        </span>
                      </div>

                      {matchedCourier ? (
                        <div className="space-y-1.5 text-neutral-800">
                          <p className="font-bold text-neutral-950 flex items-center gap-1.5">
                            <Building className="w-3.5 h-3.5 text-amber-700" />
                            <span>{matchedCourier.name} ({matchedCourier.city} Branch)</span>
                          </p>
                          <p className="text-[11px] text-neutral-700 flex items-start gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                            <span>
                              {matchedCourier.addressLine1}
                              {matchedCourier.addressLine2 ? `, ${matchedCourier.addressLine2}` : ''}, {matchedCourier.city} - {matchedCourier.pincode}
                            </span>
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
                            <p className="flex items-center gap-1.5">
                              <Phone className="w-3.5 h-3.5 text-neutral-500" />
                              <a href={`tel:${matchedCourier.phone}`} className="hover:text-amber-800 font-semibold font-mono">
                                {matchedCourier.phone}
                              </a>
                            </p>
                            <p className="flex items-center gap-1.5">
                              <Mail className="w-3.5 h-3.5 text-neutral-500" />
                              <a href={`mailto:${matchedCourier.supportEmail}`} className="hover:text-amber-800">
                                {matchedCourier.supportEmail}
                              </a>
                            </p>
                          </div>
                          {matchedCourier.mapsUrl && (
                            <div className="pt-1.5">
                              <a
                                href={matchedCourier.mapsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-100 text-amber-950 border border-amber-300 text-[11px] font-semibold transition shadow-2xs"
                              >
                                <MapPin className="w-3.5 h-3.5 text-rose-600" />
                                <span>Open Hub on Google Maps</span>
                                <ExternalLink className="w-3 h-3 text-neutral-500" />
                              </a>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-neutral-700 text-xs">
                          Courier Partner: <strong>{selectedDetailOrder.shippingDetails.courierName}</strong>
                        </p>
                      )}
                    </div>
                  );
                })()
              )}

              {/* Delivery Dispute Alert Banner in Order Detail */}
              {selectedDetailOrder.deliveryIssue?.reported && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-950 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1.5 text-rose-900">
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                      <span>Customer Delivery Issue Reported ({selectedDetailOrder.deliveryIssue.status.toUpperCase()})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDetailOrder(null);
                        onNavigateToTab?.('customers_issue');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] transition cursor-pointer"
                    >
                      Investigate in Customers Issue &rarr;
                    </button>
                  </div>
                  <p className="bg-white/80 p-2.5 rounded-xl border border-rose-200 font-medium">
                    "{selectedDetailOrder.deliveryIssue.issueDescription}"
                  </p>
                </div>
              )}

              {/* Live Work & Assignment Log */}
              <div className="p-4 rounded-2xl bg-white border border-neutral-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-serif font-bold text-neutral-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-amber-600" />
                    <span>Live Work & Assignment Log</span>
                  </h4>
                  <span className="font-mono text-[10px] text-neutral-500">
                    {(selectedDetailOrder.assignmentHistory || []).length} recorded events
                  </span>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {selectedDetailOrder.assignmentHistory && selectedDetailOrder.assignmentHistory.length > 0 ? (
                    selectedDetailOrder.assignmentHistory.map((log, idx) => (
                      <div
                        key={log.id || idx}
                        className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-200 space-y-1"
                      >
                        <div className="flex items-center justify-between text-[10px] font-mono text-neutral-500">
                          <span className="font-bold text-neutral-800">👤 {log.staffName}</span>
                          <span>{new Date(log.timestamp).toLocaleString('en-IN')}</span>
                        </div>
                        <p className="font-semibold text-neutral-900">{log.action}</p>
                        {log.note && (
                          <p className="text-neutral-600 italic bg-white p-1 rounded border border-neutral-100">
                            "{log.note}"
                          </p>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-neutral-400 italic">No logs recorded yet.</p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-between gap-3 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => {
                    const cleanPhone = selectedDetailOrder.customer.phone.replace(/[^0-9]/g, '');
                    const msg = formatWhatsAppStageUpdateMessage(
                      selectedDetailOrder,
                      settings
                    );
                    openWhatsApp(cleanPhone, msg);
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center gap-1.5 shadow-xs"
                >
                  <MessageSquare className="w-3.5 h-3.5 fill-white" />
                  <span>Send WhatsApp Update</span>
                </button>

                <div className="flex items-center gap-2 flex-wrap">
                  {selectedDetailOrder.isClosed ? (
                    <button
                      type="button"
                      onClick={() => {
                        setReopenModalOrder(selectedDetailOrder);
                        setReopenReasonText('');
                      }}
                      className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                      title="Reopen order with mandatory reason"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Reopen Order</span>
                    </button>
                  ) : selectedDetailOrder.status === 'Delivered' ? (
                    <button
                      type="button"
                      onClick={() => {
                        closeOrder(selectedDetailOrder.id, currentUser?.name);
                        setSelectedDetailOrder((prev) => prev ? { ...prev, isClosed: true, closedBy: currentUser?.name || 'Staff' } : null);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                      title="Close delivered order"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>Close Order</span>
                    </button>
                  ) : null}

                  {selectedDetailOrder.assignedStaffId !==
                    (currentUser?.staffId || (isAdmin ? 'admin' : '')) && (
                    <button
                      type="button"
                      onClick={() => handleAssignToMe(selectedDetailOrder)}
                      className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                      title="Assign this order to yourself"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>Assign to Me</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setAssignModalOrder(selectedDetailOrder);
                      setTargetStaffId(selectedDetailOrder.assignedStaffId || (staffMembers[0]?.id || ''));
                      setAssignmentReason('');
                    }}
                    className="px-3.5 py-2 rounded-xl border border-neutral-300 hover:bg-neutral-100 text-neutral-800 font-semibold transition cursor-pointer"
                  >
                    Reassign Staff
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedDetailOrder(null)}
                    className="px-4 py-2 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white font-bold transition cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reassign Modal */}
      {assignModalOrder && (
        <div className="fixed inset-0 z-60 overflow-y-auto bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 my-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 bg-neutral-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-amber-400" />
                <h3 className="font-serif font-bold text-sm">
                  Assign Staff to Order #{assignModalOrder.orderNumber}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAssignModalOrder(null)}
                className="p-1 rounded-full text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-neutral-800 mb-1">Select Staff Member *</label>
                <select
                  value={targetStaffId}
                  onChange={(e) => setTargetStaffId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white text-neutral-900"
                >
                  <option value="">-- Choose Staff --</option>
                  {staffMembers.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} (@{st.username}) · {st.role}
                    </option>
                  ))}
                  {isAdmin && <option value="admin">Store Owner</option>}
                </select>
              </div>

              <div>
                <label className="block font-bold text-neutral-800 mb-1 flex items-center justify-between">
                  <span>Assignment / Handover Reason</span>
                  {isAdmin ? (
                    <span className="text-neutral-400 font-normal">Optional for Admin</span>
                  ) : (
                    <span className="text-rose-600 font-bold">* Required for Staff</span>
                  )}
                </label>
                <input
                  type="text"
                  required={!isAdmin}
                  value={assignmentReason}
                  onChange={(e) => setAssignmentReason(e.target.value)}
                  placeholder={
                    isAdmin
                      ? 'Optional note'
                      : 'Required: state reason for assignment (e.g. emergency leave handover, shift duty)'
                  }
                  className={`w-full p-2.5 rounded-xl border bg-white text-neutral-900 ${
                    !isAdmin && !assignmentReason.trim() ? 'border-amber-400 focus:border-rose-500' : 'border-neutral-300'
                  }`}
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAssignModalOrder(null)}
                  className="px-4 py-2 rounded-xl border border-neutral-300 text-neutral-700 font-semibold hover:bg-neutral-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAssignment}
                  className="px-5 py-2 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white font-bold transition shadow-xs"
                >
                  Confirm Assignment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Work Note Modal */}
      {workNoteModalOrder && (
        <div className="fixed inset-0 z-60 overflow-y-auto bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 my-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 bg-neutral-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit className="w-4 h-4 text-amber-400" />
                <h3 className="font-serif font-bold text-sm">
                  Add Live Work Note for #{workNoteModalOrder.orderNumber}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setWorkNoteModalOrder(null)}
                className="p-1 rounded-full text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-neutral-800 mb-1">
                  Progress / Handover Update
                </label>
                <textarea
                  rows={3}
                  value={workNoteText}
                  onChange={(e) => setWorkNoteText(e.target.value)}
                  placeholder="e.g. Saree inspected for zari luster; weaver verified delivery on Tuesday..."
                  className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900 resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setWorkNoteModalOrder(null)}
                  className="px-4 py-2 rounded-xl border border-neutral-300 text-neutral-700 font-semibold hover:bg-neutral-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddWorkNote}
                  className="px-5 py-2 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white font-bold transition shadow-xs"
                >
                  Save Log Entry
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Courier & Tracking Modal for Shipped Orders (User Request 2) */}
      {shippingModalOrder && (
        <div className="fixed inset-0 z-70 overflow-y-auto bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 my-auto">
            <div className="p-4 sm:p-5 bg-neutral-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-amber-400" />
                <h3 className="font-serif text-base font-bold">
                  Update Shipment for #{shippingModalOrder.orderNumber}
                </h3>
              </div>
              <button
                type="button"
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
                  className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white text-neutral-900 font-medium"
                >
                  {(settings.courierServices && settings.courierServices.length > 0
                    ? settings.courierServices.filter((c) => c.isActive)
                    : [
                        { id: 'dtdc', name: 'DTDC Express', city: 'Salem' },
                        { id: 'bluedart', name: 'Blue Dart Express', city: 'Salem' },
                        { id: 'speedpost', name: 'India Post (Speed Post)', city: 'Salem' },
                        { id: 'delhivery', name: 'Delhivery Express', city: 'Salem' },
                        { id: 'tpc', name: 'The Professional Couriers', city: 'Salem' },
                      ]
                  ).map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name} {c.city ? `(${c.city} Hub)` : ''}
                    </option>
                  ))}
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
                  Customers can look up this consignment code on the storefront Track Order page.
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

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShippingModalOrder(null)}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl border border-neutral-300 text-neutral-700 font-semibold hover:bg-neutral-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleSaveShipping();
                    if (trackingNumber.trim()) {
                      handleSendShippingWhatsApp(
                        shippingModalOrder,
                        courierName,
                        trackingNumber.trim(),
                        shippingNotes.trim()
                      );
                    }
                  }}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <MessageSquare className="w-3.5 h-3.5 fill-white" />
                  <span>Save & Send WhatsApp</span>
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-auto px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-600 text-white font-bold transition shadow-xs"
                >
                  Save & Mark Shipped
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancellation & Refund Modal (User Request 2) */}
      {cancellationModalOrder && (
        <div className="fixed inset-0 z-70 overflow-y-auto bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 my-auto">
            <div className="p-4 sm:p-5 bg-rose-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-rose-400" />
                <h3 className="font-serif text-base font-bold">
                  {cancellationModalOrder.targetStatus} Order #{cancellationModalOrder.order.orderNumber}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCancellationModalOrder(null)}
                className="p-1 rounded-full text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCancellation} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-rose-950 space-y-1">
                <p className="font-bold">Customer Coordinates for Refund:</p>
                <p>
                  Customer: <strong>{cancellationModalOrder.order.customer.name}</strong>
                </p>
                <p>
                  Phone: <strong>{cancellationModalOrder.order.customer.phone}</strong>
                </p>
                <p>
                  Total to Refund:{' '}
                  <strong className="text-rose-900">
                    {formatPrice(cancellationModalOrder.order.totalAmount)}
                  </strong>
                </p>
              </div>

              <div>
                <label className="block font-bold text-neutral-800 mb-1">
                  Reason for {cancellationModalOrder.targetStatus} *
                </label>
                <select
                  value={cancellationReasonPreset}
                  onChange={(e) => setCancellationReasonPreset(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white text-neutral-900 font-medium"
                >
                  <option value="Weaver Loom Backlog / Out of Stock">
                    Weaver Loom Backlog / Out of Stock
                  </option>
                  <option value="Customer Requested Cancellation">
                    Customer Requested Cancellation
                  </option>
                  <option value="Payment Verification Mismatch">
                    Payment Verification Mismatch
                  </option>
                  <option value="Delivery Pincode Unserviceable">
                    Delivery Pincode Unserviceable
                  </option>
                  <option value="Other Reason">Other Reason (Specify below)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Additional Details / Custom Reason
                </label>
                <input
                  type="text"
                  value={cancellationReasonCustom}
                  onChange={(e) => setCancellationReasonCustom(e.target.value)}
                  placeholder="e.g. Silk shade batch unavailable from master weaver"
                  className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-800 mb-1">
                  Bank Refund Transaction ID (UTR Number)
                </label>
                <input
                  type="text"
                  value={refundUtr}
                  onChange={(e) => setRefundUtr(e.target.value)}
                  placeholder="e.g. UTR928103847291 (if already processed)"
                  className="w-full p-2.5 rounded-xl border border-neutral-300 font-mono text-xs text-neutral-900 uppercase"
                />
                <p className="text-[11px] text-neutral-500 mt-1">
                  If entered, the order refund status will be marked as processed and sent to the client.
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
                  placeholder="e.g. Processed via boutique business account"
                  className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCancellationModalOrder(null)}
                  className="px-4 py-2 rounded-xl border border-neutral-300 text-neutral-700 font-semibold hover:bg-neutral-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-rose-700 hover:bg-rose-600 text-white font-bold transition shadow-xs"
                >
                  Save & Mark {cancellationModalOrder.targetStatus}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mandatory Assignment Prompt Modal (User Request 5 & Confirmed Choice) */}
      {mandatoryAssignPromptOrder && (
        <div className="fixed inset-0 z-70 overflow-y-auto bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 my-auto">
            <div className="p-5 bg-gradient-to-r from-amber-950 via-neutral-900 to-amber-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <AlertCircle className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-serif text-base font-bold text-white">
                    Assignment Required
                  </h3>
                  <p className="text-[11px] text-amber-300">
                    Order #{mandatoryAssignPromptOrder.order.orderNumber}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMandatoryAssignPromptOrder(null)}
                className="p-1 rounded-full text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-neutral-700">
              <p className="leading-relaxed">
                Before updating the order stage to{' '}
                <strong className="text-neutral-950 font-bold bg-neutral-100 px-1.5 py-0.5 rounded">
                  {mandatoryAssignPromptOrder.intendedStatus || 'next stage'}
                </strong>
                , this order must be assigned to an active boutique staff concierge or store owner.
              </p>

              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 space-y-1.5 text-[11px] text-amber-950">
                <span className="font-bold flex items-center gap-1.5 text-amber-900">
                  <UserCheck className="w-3.5 h-3.5 text-amber-600" />
                  <span>One-Click Assignment:</span>
                </span>
                <p>
                  Claim as{' '}
                  <strong className="font-bold">
                    {currentUser?.name || (isAdmin ? 'Store Owner' : 'Staff Concierge')}
                  </strong>{' '}
                  ({isAdmin ? 'Store Owner' : `@${currentUser?.username || 'staff'}`}) to proceed immediately.
                </p>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleClaimAndContinueStage}
                  className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Assign to Me & Continue</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const ord = mandatoryAssignPromptOrder.order;
                    setMandatoryAssignPromptOrder(null);
                    setAssignModalOrder(ord);
                    setTargetStaffId(staffMembers[0]?.id || 'admin');
                    setAssignmentReason('');
                  }}
                  className="w-full py-2 px-4 rounded-xl border border-neutral-300 hover:bg-neutral-100 text-neutral-800 font-semibold text-xs transition cursor-pointer"
                >
                  Assign to Another Staff Member...
                </button>

                <button
                  type="button"
                  onClick={() => setMandatoryAssignPromptOrder(null)}
                  className="w-full py-1.5 text-neutral-500 hover:text-neutral-800 text-[11px] transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reopen Order Modal with Mandatory Reason (User Request 5 & Plan) */}
      {reopenModalOrder && (
        <div className="fixed inset-0 z-60 bg-neutral-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-neutral-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 bg-gradient-to-r from-neutral-900 to-neutral-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-sm">Reopen Closed Order</h3>
                  <p className="text-[11px] text-neutral-400 font-mono">
                    Order #{reopenModalOrder.orderNumber}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReopenModalOrder(null)}
                className="p-1 rounded-full text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!reopenReasonText.trim()) return;
                reopenOrder(reopenModalOrder.id, currentUser?.name || 'Staff', reopenReasonText.trim());
                if (selectedDetailOrder?.id === reopenModalOrder.id) {
                  setSelectedDetailOrder((prev) =>
                    prev ? { ...prev, isClosed: false, reopenReason: reopenReasonText.trim() } : null
                  );
                }
                setReopenModalOrder(null);
                setReopenReasonText('');
              }}
              className="p-6 space-y-4"
            >
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 text-xs leading-relaxed space-y-1">
                <p className="font-bold text-amber-900">Mandatory Reopening Reason</p>
                <p className="text-[11px]">
                  Before reopening this closed order to make updates or re-dispatch, you must state why this order is being reopened (e.g. exchange, return verification, courier dispute). This reason will be logged in the order's history.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-800 mb-1.5">
                  State Reason for Reopening <span className="text-rose-600">*</span>
                </label>
                <textarea
                  value={reopenReasonText}
                  onChange={(e) => setReopenReasonText(e.target.value)}
                  placeholder="e.g. Customer requested size exchange, courier returned shipment for address dispute, saree inspection requested..."
                  rows={3}
                  required
                  className="w-full p-3 rounded-xl border border-neutral-300 text-xs focus:ring-2 focus:ring-amber-500/40 focus:outline-hidden"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReopenModalOrder(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-600 hover:bg-neutral-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!reopenReasonText.trim()}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Confirm & Reopen Order</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
