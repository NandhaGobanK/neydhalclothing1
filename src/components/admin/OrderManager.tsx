import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useStore, getBoutiqueOrderPrefix } from '../../context/StoreContext';
import { Order, OrderStatus } from '../../types/store';
import { syncOrdersToGoogleSheet } from '../../utils/googleSheets';
import { getAccessToken } from '../../utils/firebaseAuth';
import { playOrderNotificationSound } from '../../utils/audio';
import {
  formatPrice,
  formatWhatsAppStageUpdateMessage,
  formatWhatsAppRefundMessage,
  openWhatsApp,
  getOrderDynamicVariables,
  DynamicVariableItem,
} from '../../utils/upi';
import {
  Search,
  CheckCircle,
  CheckCircle2,
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
  FileSpreadsheet,
  ExternalLink,
  RefreshCw,
  Volume2,
  VolumeX,
  Bell,
  UserCheck,
  UserPlus,
  History,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ChevronsUpDown,
  Maximize2,
  Minimize2,
  Globe,
  Ban,
  MapPin,
  Phone,
  Mail,
  Trash2,
} from 'lucide-react';
import { OrderLiveChat } from '../common/OrderLiveChat';
import { CourierLogisticsPanel } from '../common/CourierLogisticsPanel';
import { hasActiveCustomerIssue } from '../../utils/disputeRedressals';

interface OrderManagerProps {
  onNavigateToTab?: (tab: string, staffId?: string) => void;
  initialOrderId?: string | null;
  onClearInitialOrder?: () => void;
}

export const OrderManager: React.FC<OrderManagerProps> = ({
  onNavigateToTab,
  initialOrderId,
  onClearInitialOrder,
}) => {
  const {
    orders,
    deleteOrder,
    updateOrderStatus,
    updateOrderShipping,
    markRefundProcessed,
    assignOrderStaff,
    addOrderWorkLog,
    resolveCancellationRequest,
    resolveDeliveryIssue,
    addInvestigationComment,
    closeOrder,
    reopenOrder,
    replenishOrderInventory,
    staffMembers,
    settings,
    updateSettings,
    currentUser,
    currentPermissions,
    activeAdminChatOrderId,
    setActiveAdminChatOrderId,
  } = useStore();
  const isAdmin = currentUser?.type === 'admin';
  const currentUserName = currentUser?.name || (isAdmin ? 'Store Owner' : 'Staff Concierge');
  const currentUserId = currentUser?.staffId || (isAdmin ? 'admin' : '');
  const canEditOrders = isAdmin || currentPermissions?.orders?.canEdit !== false;
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Dedicated Order Deletion / Removal State for Staff & Admins
  const [deletingOrder, setDeletingOrder] = useState<Order | null>(null);
  const [deleteRestockItems, setDeleteRestockItems] = useState(false);
  const [deleteReasonNote, setDeleteReasonNote] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteSuccessToast, setDeleteSuccessToast] = useState<{ orderNumber: string } | null>(null);

  const handleConfirmDeleteOrder = async () => {
    if (!deletingOrder) return;
    setIsDeleting(true);
    const ordNum = deletingOrder.orderNumber;
    try {
      await deleteOrder(deletingOrder.id, {
        restockItems: deleteRestockItems,
        reason: deleteReasonNote.trim() || undefined,
      });
      if (selectedDetailOrder?.id === deletingOrder.id) {
        setSelectedDetailOrder(null);
      }
      setExpandedOrderIds((prev) => {
        const next = new Set(prev);
        next.delete(deletingOrder.id);
        return next;
      });
      setDeleteSuccessToast({ orderNumber: ordNum });
      setTimeout(() => setDeleteSuccessToast(null), 4000);
      setDeletingOrder(null);
    } catch (err: any) {
      console.error('Failed to delete order:', err);
      alert('Failed to remove order record. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Auto-open live chat when deep linked from staff notification
  useEffect(() => {
    if (activeAdminChatOrderId) {
      const match = orders.find((o) => o.id === activeAdminChatOrderId);
      if (match) {
        setLiveChatOrder(match);
      }
      setActiveAdminChatOrderId(null);
    }
  }, [activeAdminChatOrderId, orders, setActiveAdminChatOrderId]);

  // Dedicated Dispute Investigation & Resolution State
  const [investigationInputText, setInvestigationInputText] = useState<{ [orderId: string]: string }>({});
  const [resolvingDisputeOrder, setResolvingDisputeOrder] = useState<Order | null>(null);
  const [disputeResolutionNote, setDisputeResolutionNote] = useState('');
  const [cancellationApproveOrder, setCancellationApproveOrder] = useState<Order | null>(null);
  const [cancellationApproveUtr, setCancellationApproveUtr] = useState('');
  const [cancellationApproveTool, setCancellationApproveTool] = useState('UPI Banking');
  const [cancellationApproveNotes, setCancellationApproveNotes] = useState('');
  const [cancellationApproveUpiTarget, setCancellationApproveUpiTarget] = useState('');
  const [cancellationDeclineOrder, setCancellationDeclineOrder] = useState<Order | null>(null);
  const [cancellationDeclineReason, setCancellationDeclineReason] = useState(
    'Saree has already been packed and handed over to courier dispatch'
  );
  const [refundVerificationOrder, setRefundVerificationOrder] = useState<Order | null>(null);
  const [refundVerifyUtr, setRefundVerifyUtr] = useState('');
  const [refundVerifyTool, setRefundVerifyTool] = useState('UPI Banking');
  const [refundVerifyNotes, setRefundVerifyNotes] = useState('');

  const handleConfirmCancellationApproval = (order: Order) => {
    const utr = cancellationApproveUtr.trim() || `UTR${Date.now().toString().slice(-8)}`;
    const notes = cancellationApproveNotes.trim() || 'Cancellation approved by concierge. Saree auto-restocked to inventory.';

    // 1. Trigger context resolution (handles status, exact stock replenishment, isClosed, refundDetails)
    resolveCancellationRequest(order.id, 'approve', notes, utr);

    // 2. Immediately update selectedDetailOrder in place so modal view reflects changes without refresh
    if (selectedDetailOrder && selectedDetailOrder.id === order.id) {
      const nowIso = new Date().toISOString();
      setSelectedDetailOrder({
        ...selectedDetailOrder,
        status: 'Cancelled',
        isRestocked: true,
        isClosed: true,
        closedAt: nowIso,
        closedBy: currentUserName,
        cancellationReason: order.cancellationRequest?.reason || 'Customer cancellation approved',
        cancellationRequest: {
          ...(selectedDetailOrder.cancellationRequest || {
            requested: true,
            requestedAt: nowIso,
            reason: 'Customer requested',
            customerPhone: selectedDetailOrder.customer.phone,
          }),
          status: 'approved',
          adminDecisionNotes: notes,
        },
        deliveryIssue: selectedDetailOrder.deliveryIssue
          ? {
              ...selectedDetailOrder.deliveryIssue,
              status: 'resolved',
              resolvedAt: nowIso,
              resolvedBy: currentUserName,
              resolutionNotes: notes,
            }
          : undefined,
        refundDetails: {
          ...selectedDetailOrder.refundDetails,
          refundStatus: 'processed',
          refundUtr: utr,
          refundTool: cancellationApproveTool,
          refundAmount: selectedDetailOrder.totalAmount,
          refundUpiId: cancellationApproveUpiTarget || selectedDetailOrder.refundDetails?.refundUpiId,
          processedAt: nowIso,
          notes: notes,
        },
      });
    }

    setCancellationApproveOrder(null);
  };

  const handleConfirmCancellationDecline = (order: Order) => {
    const reason = cancellationDeclineReason.trim() || 'Cancellation request declined by concierge.';
    resolveCancellationRequest(order.id, 'reject', reason);

    if (selectedDetailOrder && selectedDetailOrder.id === order.id) {
      const nowIso = new Date().toISOString();
      setSelectedDetailOrder({
        ...selectedDetailOrder,
        cancellationRequest: {
          ...(selectedDetailOrder.cancellationRequest || {
            requested: true,
            requestedAt: nowIso,
            reason: 'Customer requested',
            customerPhone: selectedDetailOrder.customer.phone,
          }),
          status: 'rejected',
          adminDecisionNotes: reason,
        },
        deliveryIssue: selectedDetailOrder.deliveryIssue
          ? {
              ...selectedDetailOrder.deliveryIssue,
              status: 'resolved',
              resolvedAt: nowIso,
              resolvedBy: currentUserName,
              resolutionNotes: `Cancellation request declined: ${reason}`,
            }
          : undefined,
      });
    }

    setCancellationDeclineOrder(null);
  };

  // Handle initialOrderId navigation from Customer Issues tab
  useEffect(() => {
    if (initialOrderId && orders.length > 0) {
      const cleanTarget = initialOrderId.trim().toUpperCase().replace(/^[#\s]+/, '');
      const found = orders.find(
        (o) =>
          o.id === initialOrderId ||
          o.orderNumber.toUpperCase() === initialOrderId.toUpperCase() ||
          o.orderNumber.toUpperCase().replace(/^[#\s]+/, '') === cleanTarget
      );
      if (found) {
        setSelectedDetailOrder(found);
        setGlobalOrderSearch(found.orderNumber);
        setExpandedOrderIds((prev) => new Set([...prev, found.id]));
        onClearInitialOrder?.();
      }
    }
  }, [initialOrderId, orders, onClearInitialOrder]);

  const getCourierDetails = (name?: string) =>
    (settings.courierServices || []).find(
      (c) => c.name.toLowerCase().trim() === (name || '').toLowerCase().trim()
    );

  // Dispute Categorization Helpers (Cleanly separates refund reports, cancellations, and delivery disputes)
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

  // Clickable / expandable order cards (User Request: each Item ordered display is too lengthy, make orders in clickable format)
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(new Set());

  const toggleOrderExpand = (orderId: string) => {
    setExpandedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  // Sound Notification on New Order Received (User Request)
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [newOrderAlert, setNewOrderAlert] = useState<Order | null>(null);
  const prevOrdersCountRef = useRef<number>(orders.length);
  const isFirstRenderRef = useRef<boolean>(true);

  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      prevOrdersCountRef.current = orders.length;
      return;
    }

    // Detect if order count increased
    if (orders.length > prevOrdersCountRef.current) {
      const latestOrder = orders[0];
      if (latestOrder) {
        setNewOrderAlert(latestOrder);
        if (soundEnabled) {
          playOrderNotificationSound();
        }
      }
    }
    prevOrdersCountRef.current = orders.length;
  }, [orders.length, soundEnabled]);

  // Assignment Modal State (Prompt Request: assign buttons and work tracking with emergency leave transfer note)
  const [assignModalOrder, setAssignModalOrder] = useState<Order | null>(null);
  const [targetStaffId, setTargetStaffId] = useState('');
  const [assignmentReason, setAssignmentReason] = useState('');

  // Work Note Log Modal State
  const [workLogModalOrder, setWorkLogModalOrder] = useState<Order | null>(null);
  const [workLogAction, setWorkLogAction] = useState('Work Update');
  const [workLogNote, setWorkLogNote] = useState('');

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

  // Mandatory Assignment Modal State before stage change (User Request 5 & Confirmed Choice)
  const [mandatoryAssignPromptOrder, setMandatoryAssignPromptOrder] = useState<{
    order: Order;
    intendedStatus?: OrderStatus;
  } | null>(null);

  // Refund Modal State with 12-digit UTR validation and transaction tool
  const [refundModalOrder, setRefundModalOrder] = useState<Order | null>(null);
  const [refundUtr, setRefundUtr] = useState('');
  const [refundTool, setRefundTool] = useState('PhonePe');
  const [refundUtrError, setRefundUtrError] = useState<string | null>(null);
  const [refundNotes, setRefundNotes] = useState('');

  // Global Cross-Bucket Order Search State (Requirement 7)
  const [globalOrderSearch, setGlobalOrderSearch] = useState('');
  const [selectedDetailOrder, setSelectedDetailOrder] = useState<Order | null>(null);

  // Editable Automated Message Dispatcher Modal (User Request)
  const [messageModalOrder, setMessageModalOrder] = useState<Order | null>(null);
  const [liveChatOrder, setLiveChatOrder] = useState<Order | null>(null);
  const [messageModalStage, setMessageModalStage] = useState<OrderStatus>('Pending');
  const [messageModalText, setMessageModalText] = useState<string>('');
  const [messageModalCopied, setMessageModalCopied] = useState(false);
  const [messageModalCategory, setMessageModalCategory] = useState<'all' | 'essential' | 'customer' | 'shipping' | 'refund' | 'store'>('all');
  const [updateOrderStatusOnSend, setUpdateOrderStatusOnSend] = useState(false);
  const messageTextareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const messageSelectionRef = React.useRef<{ start: number; end: number }>({ start: 0, end: 0 });

  const handleSaveMessageSelection = () => {
    if (messageTextareaRef.current) {
      messageSelectionRef.current = {
        start: messageTextareaRef.current.selectionStart ?? 0,
        end: messageTextareaRef.current.selectionEnd ?? 0,
      };
    }
  };

  // Google Sheets Sync States
  const [isSyncingSheets, setIsSyncingSheets] = useState(false);
  const [sheetSyncSuccess, setSheetSyncSuccess] = useState<{ url: string; count: number } | null>(null);
  const [sheetSyncError, setSheetSyncError] = useState<string | null>(null);
  const [isConfirmSyncOpen, setIsConfirmSyncOpen] = useState(false);

  const handleConfirmSyncSheets = async () => {
    setIsConfirmSyncOpen(false);
    setIsSyncingSheets(true);
    setSheetSyncError(null);
    setSheetSyncSuccess(null);

    try {
      // Single point of storage: reuse master spreadsheet ID if already created
      const targetSpreadsheetId =
        settings.ordersSpreadsheetId || settings.analyticsSpreadsheetId;
      const res = await syncOrdersToGoogleSheet(
        orders,
        settings.boutiqueName,
        targetSpreadsheetId
      );
      if (res.success) {
        setSheetSyncSuccess({ url: res.spreadsheetUrl, count: res.rowsUpdated });
        updateSettings({
          ordersSpreadsheetId: res.spreadsheetId,
          ordersSpreadsheetUrl: res.spreadsheetUrl,
          analyticsSpreadsheetId: res.spreadsheetId,
          analyticsSpreadsheetUrl: res.spreadsheetUrl,
        });
      }
    } catch (err: any) {
      console.error('Failed to sync orders to Google Sheets:', err);
      setSheetSyncError(err.message || 'Failed to synchronize orders with Google Sheets.');
    } finally {
      setIsSyncingSheets(false);
    }
  };

  const handleAuthorizeAndSync = async () => {
    setIsSyncingSheets(true);
    setSheetSyncError(null);
    try {
      await getAccessToken(true, true);
      await handleConfirmSyncSheets();
    } catch (err: any) {
      setSheetSyncError(err?.message || 'Authorization failed. Please try again.');
      setIsSyncingSheets(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Dynamic Queue Filter: Defaults to 'unassigned' so assigned orders clear from the Order Page and move to staff/admin buckets
  const [activeQueueFilter, setActiveQueueFilter] = useState<'unassigned' | 'all' | 'mine'>('unassigned');
  const [assignmentToast, setAssignmentToast] = useState<{
    orderNumber: string;
    staffName: string;
    staffId: string;
  } | null>(null);

  const unassignedOrders = useMemo(() => {
    return orders.filter(
      (o) => (!o.assignedStaffId || o.assignedStaffId === 'unassigned') && !hasActiveCustomerIssue(o)
    );
  }, [orders]);

  const myBucketOrders = useMemo(() => {
    const myId = currentUser?.staffId || (isAdmin ? 'admin' : '');
    return orders.filter((o) => o.assignedStaffId === myId);
  }, [orders, currentUser, isAdmin]);

  const adminBucketCount = useMemo(() => {
    return orders.filter((o) => o.assignedStaffId === 'admin').length;
  }, [orders]);

  // Streamlined Multi-Parameter Global Order Search
  // Searches across ALL buckets regardless of queue filter:
  // 1. Order Number (e.g., #NC-2481, NC-2481, 2481, nc2481)
  // 2. Customer Name (e.g., Ananya, Priya)
  // 3. Mobile Number (e.g., 9876543210, partial digits)
  // 4. UTR Number (Prepaid Transaction UTR or Refund Bank UTR)
  const displayOrders = useMemo(() => {
    if (globalOrderSearch.trim()) {
      const raw = globalOrderSearch.trim();
      const q = raw.toLowerCase();
      const cleanNum = q.replace(/^[#\s]+/, '').trim();
      const searchDigits = raw.replace(/\D/g, '');
      const cleanAlphanumeric = raw.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

      return orders.filter((o) => {
        // 1. Order Number matching (matches with or without hash, dash, spaces, partial digits)
        const oNum = o.orderNumber.toLowerCase().replace(/^[#\s]+/, '').trim();
        const oNumDigits = o.orderNumber.replace(/\D/g, '');
        const orderAlphanumeric = o.orderNumber.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

        const matchesOrderNumber =
          oNum === cleanNum ||
          oNum.includes(cleanNum) ||
          o.orderNumber.toLowerCase().includes(q) ||
          (`#${o.orderNumber.toLowerCase()}`).includes(q) ||
          (cleanAlphanumeric.length >= 2 && orderAlphanumeric.includes(cleanAlphanumeric)) ||
          (searchDigits.length >= 2 && oNumDigits.includes(searchDigits));

        // 2. Customer Name matching
        const matchesCustomerName = o.customer.name.toLowerCase().includes(q);

        // 3. Mobile Number matching
        const phoneDigits = o.customer.phone.replace(/\D/g, '');
        const matchesMobile =
          o.customer.phone.toLowerCase().includes(q) ||
          (searchDigits.length >= 3 && phoneDigits.includes(searchDigits));

        // 4. UTR Number matching (payment UTR & refund UTR)
        const matchesPaymentUtr = Boolean(
          o.upiTransactionId && (
            o.upiTransactionId.toLowerCase().includes(cleanNum) ||
            o.upiTransactionId.toLowerCase().includes(q)
          )
        );
        const matchesRefundUtr = Boolean(
          o.refundDetails?.refundUtr && (
            o.refundDetails.refundUtr.toLowerCase().includes(cleanNum) ||
            o.refundDetails.refundUtr.toLowerCase().includes(q)
          )
        );

        // 5. SKU matching
        const matchesSku = o.items.some(
          (it) => it.product.productCode && it.product.productCode.toLowerCase().includes(cleanNum)
        );

        return (
          matchesOrderNumber ||
          matchesCustomerName ||
          matchesMobile ||
          matchesPaymentUtr ||
          matchesRefundUtr ||
          matchesSku
        );
      });
    }

    if (activeQueueFilter === 'all') {
      return orders;
    }
    if (activeQueueFilter === 'mine') {
      return myBucketOrders;
    }
    // Default is 'unassigned' queue: Once assigned, order clears from the order page and moves to assigned staff/admin bucket
    return unassignedOrders;
  }, [orders, globalOrderSearch, activeQueueFilter, unassignedOrders, myBucketOrders]);

  const handleStatusChange = (order: Order, newStatus: OrderStatus) => {
    // User Requirement 5: Order must be assigned before changing stages and working on it
    if (!order.assignedStaffId || order.assignedStaffId === 'unassigned') {
      setMandatoryAssignPromptOrder({ order, intendedStatus: newStatus });
      return;
    }

    if (newStatus === 'Shipped') {
      // Courier Details Exception for Shipped Stage: prompt for courier details first
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
      setAssignmentToast({
        orderNumber: order.orderNumber,
        staffName: myName,
        staffId: myId,
      });
      const updatedOrder: Order = {
        ...order,
        assignedStaffId: myId,
        assignedStaffName: myName,
      };

      setMandatoryAssignPromptOrder(null);

      if (intendedStatus) {
        handleStatusChange(updatedOrder, intendedStatus);
      }
    } else {
      setMandatoryAssignPromptOrder(null);
      setAssignModalOrder(order);
      setTargetStaffId(staffMembers[0]?.id || 'admin');
      setAssignmentReason('Assigned to start work');
    }
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

    // Requirement 3: Open refund prompt immediately with 12-digit UTR validation & transaction tool
    setRefundModalOrder(updatedOrder);
    setRefundUtr('');
    setRefundTool('PhonePe');
    setRefundUtrError(null);
    setRefundNotes('');
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

    // Open message modal with dynamic variables populated (tracking ID, courier, etc.)
    handleOpenMessageModal(updatedOrder, 'Shipped');
  };

  const handleSaveRefund = (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundModalOrder) return;

    const cleanUtr = refundUtr.trim();
    // Requirement 3: 12-digit numeric validation rules
    if (!/^\d{12}$/.test(cleanUtr)) {
      setRefundUtrError('Bank UTR Number must be exactly 12 numeric digits (e.g. 402819283741)');
      return;
    }
    setRefundUtrError(null);

    markRefundProcessed(refundModalOrder.id, cleanUtr, refundTool, refundNotes.trim());

    const updatedOrder: Order = {
      ...refundModalOrder,
      status: 'Refunded',
      refundDetails: {
        ...refundModalOrder.refundDetails,
        refundStatus: 'processed',
        refundUtr: cleanUtr,
        refundTool,
        refundAmount: refundModalOrder.totalAmount,
        processedAt: new Date().toISOString(),
      },
    };

    setRefundModalOrder(null);

    // Open message modal populated with refund UTR details
    setMessageModalOrder(updatedOrder);
    setMessageModalStage('Refunded');
    const refundMsg = formatWhatsAppRefundMessage(updatedOrder, settings);
    setMessageModalText(refundMsg);
  };

  const handleOpenMessageModal = (order: Order, stageOverride?: OrderStatus) => {
    const stage = stageOverride || order.status;
    setMessageModalOrder(order);
    setMessageModalStage(stage);
    setUpdateOrderStatusOnSend(false);
    setMessageModalCopied(false);
    const orderWithStage: Order = stageOverride && stageOverride !== order.status ? { ...order, status: stageOverride } : order;
    const initialText = formatWhatsAppStageUpdateMessage(orderWithStage, settings);
    setMessageModalText(initialText);
    messageSelectionRef.current = { start: initialText.length, end: initialText.length };
  };

  const handleSwitchMessageModalStage = (newStage: OrderStatus) => {
    if (!messageModalOrder) return;
    setMessageModalStage(newStage);
    const orderWithStage: Order = { ...messageModalOrder, status: newStage };
    const text = formatWhatsAppStageUpdateMessage(orderWithStage, settings);
    setMessageModalText(text);
    messageSelectionRef.current = { start: text.length, end: text.length };
  };

  const handleResetModalMessageToTemplate = () => {
    if (!messageModalOrder) return;
    const orderWithStage: Order = { ...messageModalOrder, status: messageModalStage };
    const text = formatWhatsAppStageUpdateMessage(orderWithStage, settings);
    setMessageModalText(text);
    messageSelectionRef.current = { start: text.length, end: text.length };
  };

  const handleInsertDynamicVariable = (val: string) => {
    const textarea = messageTextareaRef.current;
    const current = messageModalText;
    const { start, end } = messageSelectionRef.current;

    const selStart = Math.min(Math.max(0, start), current.length);
    const selEnd = Math.min(Math.max(0, end), current.length);

    const before = current.substring(0, selStart);
    const after = current.substring(selEnd);

    const updatedText = before + val + after;
    setMessageModalText(updatedText);

    const newCursor = selStart + val.length;
    messageSelectionRef.current = { start: newCursor, end: newCursor };

    setTimeout(() => {
      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(newCursor, newCursor);
      }
    }, 0);
  };

  const handleSendCustomWhatsApp = () => {
    if (!messageModalOrder || !messageModalText.trim()) return;
    if (updateOrderStatusOnSend && messageModalOrder.status !== messageModalStage) {
      updateOrderStatus(messageModalOrder.id, messageModalStage);
    }
    openWhatsApp(messageModalOrder.customer.phone, messageModalText);
    setMessageModalOrder(null);
  };

  const handleCopyModalMessage = () => {
    if (!messageModalText) return;
    navigator.clipboard.writeText(messageModalText);
    setMessageModalCopied(true);
    setTimeout(() => setMessageModalCopied(false), 2000);
  };

  const handleSendStageWhatsApp = (order: Order) => {
    handleOpenMessageModal(order, order.status);
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
      'Assigned Handling Staff',
      'Last Handled By Username',
      'Total Amount',
      'Payment Transaction UTR',
      'Courier Name',
      'Tracking Number',
      'Refund UPI ID',
      'Refund UPI Phone',
      'Refund Status',
      'Refund UTR ID',
      'Customer Comments',
      'Staff Work & Assignment History',
    ];

    const rows = orders.map((o) => {
      const historyStr = (o.assignmentHistory || [])
        .map((h) => `[${new Date(h.timestamp).toLocaleDateString('en-IN')}] ${h.staffName}: ${h.action}${h.note ? ` (${h.note})` : ''}`)
        .join('; ');

      return [
        o.orderNumber,
        new Date(o.createdAt).toLocaleDateString('en-IN'),
        `"${o.customer.name}"`,
        `"${o.customer.phone}"`,
        `"${o.customer.email}"`,
        `"${o.customer.address}, ${o.customer.city}, ${o.customer.state} ${o.customer.pincode}"`,
        o.status,
        `"${o.assignedStaffName || 'Unassigned'}"`,
        `"${o.lastUpdatedBy || ''}"`,
        o.totalAmount,
        `"${o.upiTransactionId}"`,
        `"${o.shippingDetails?.courierName || ''}"`,
        `"${o.shippingDetails?.trackingNumber || ''}"`,
        `"${o.refundDetails?.refundUpiId || ''}"`,
        `"${o.refundDetails?.refundUpiPhone || ''}"`,
        o.refundDetails?.refundStatus || '',
        `"${o.refundDetails?.refundUtr || ''}"`,
        `"${(o.notes || '').replace(/"/g, '""')}"`,
        `"${historyStr.replace(/"/g, '""')}"`,
      ];
    });

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
      {/* Top Header: Minimal layout with Sound Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-neutral-900 flex items-center gap-2">
            <span>Orders</span>
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Search orders across all buckets. Click any order to directly inspect its complete status.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Audio Notification Toggle and Test Button */}
          <div className="inline-flex items-center gap-1 p-1 bg-neutral-100 rounded-xl border border-neutral-200">
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                soundEnabled
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-neutral-200 text-neutral-600'
              }`}
              title={soundEnabled ? 'Order sound alert enabled' : 'Order sound alert muted'}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span>{soundEnabled ? 'Sound On' : 'Muted'}</span>
            </button>
            <button
              type="button"
              onClick={() => playOrderNotificationSound()}
              className="p-1.5 rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200 text-xs font-medium transition cursor-pointer"
              title="Test Order Chime"
            >
              <Bell className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Order Alert Banner (Only Order alerts display here) */}
      {newOrderAlert && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 text-neutral-950 shadow-lg border border-amber-400 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in slide-in-from-top-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-neutral-950 text-amber-400 shrink-0">
              <Bell className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-neutral-950">🔔 New Customer Order Received!</h4>
              <p className="text-xs text-neutral-900/90 font-medium">
                Order #{newOrderAlert.orderNumber} for {formatPrice(newOrderAlert.totalAmount)} by {newOrderAlert.customer.name} ({newOrderAlert.customer.phone})
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <button
              type="button"
              onClick={() => {
                setSelectedDetailOrder(newOrderAlert);
                setGlobalOrderSearch(newOrderAlert.orderNumber);
                setNewOrderAlert(null);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-bold transition shadow-xs cursor-pointer"
            >
              Inspect Order #{newOrderAlert.orderNumber}
            </button>
            <button
              type="button"
              onClick={() => setNewOrderAlert(null)}
              className="p-1.5 rounded-lg text-neutral-950 hover:bg-amber-400 transition cursor-pointer"
              title="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Assignment Success & Dynamic Bucket Routing Banner */}
      {assignmentToast && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white text-xs font-medium shadow-md flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-white/20 text-white shrink-0">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-white text-sm">
                Order #{assignmentToast.orderNumber} Assigned to {assignmentToast.staffName}!
              </p>
              <p className="text-emerald-100 text-xs">
                Cleared from the Order Page intake queue and moved into <strong>{assignmentToast.staffName}</strong>'s bucket. Search <strong>#{assignmentToast.orderNumber}</strong> anytime on this page to open it.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setGlobalOrderSearch(assignmentToast.orderNumber);
              }}
              className="px-3 py-1.5 rounded-xl bg-emerald-950 hover:bg-emerald-900 text-white font-bold transition shadow-xs cursor-pointer text-xs flex items-center gap-1"
            >
              <Search className="w-3 h-3 text-amber-300" />
              <span>Search #{assignmentToast.orderNumber} Here</span>
            </button>
            {onNavigateToTab && (
              <button
                type="button"
                onClick={() => {
                  if (assignmentToast.staffId === 'admin') {
                    onNavigateToTab('admin_bucket');
                  } else {
                    onNavigateToTab('staff_buckets', assignmentToast.staffId);
                  }
                  setAssignmentToast(null);
                }}
                className="px-3 py-1.5 rounded-xl bg-white text-emerald-950 font-bold hover:bg-emerald-50 transition shadow-xs cursor-pointer text-xs flex items-center gap-1"
              >
                <span>View in {assignmentToast.staffName}'s Bucket</span>
                <ChevronRight className="w-3 h-3 text-emerald-700" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setAssignmentToast(null)}
              className="text-white/80 hover:text-white font-bold p-1 cursor-pointer"
              title="Dismiss notification"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Order Deletion Success Banner */}
      {deleteSuccessToast && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-rose-950 via-neutral-900 to-rose-900 text-white text-xs font-medium shadow-md flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 border border-rose-500/30">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-300 shrink-0">
              <Trash2 className="w-4 h-4 text-rose-400" />
            </div>
            <div>
              <p className="font-bold text-white text-sm">
                Order #{deleteSuccessToast.orderNumber} Deleted Successfully
              </p>
              <p className="text-rose-200 text-xs">
                The order record has been permanently removed from the active order queue, staff buckets, and database.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDeleteSuccessToast(null)}
            className="text-white/80 hover:text-white font-bold p-1 cursor-pointer"
            title="Dismiss notification"
          >
            &times;
          </button>
        </div>
      )}

      {/* Multi-Parameter Global Search Bar & Dynamic Queue Routing Tabs */}
      <div className="bg-white rounded-2xl border border-neutral-300 p-3 sm:p-4 shadow-xs space-y-3">
        {/* Dynamic Queue Routing Tabs */}
        <div className="flex items-center justify-between gap-3 flex-wrap border-b border-neutral-100 pb-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mr-1">
              Order Queue:
            </span>
            <button
              type="button"
              onClick={() => {
                setActiveQueueFilter('unassigned');
                setGlobalOrderSearch('');
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                activeQueueFilter === 'unassigned' && !globalOrderSearch
                  ? 'bg-amber-500 text-neutral-950 font-bold shadow-xs'
                  : unassignedOrders.length > 0
                  ? 'bg-amber-100 text-amber-950 border border-amber-300 font-bold hover:bg-amber-200'
                  : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
              }`}
            >
              <span>📥 Unassigned Orders</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeQueueFilter === 'unassigned' && !globalOrderSearch ? 'bg-neutral-950 text-amber-300' : 'bg-amber-200 text-amber-950'
              }`}>
                {unassignedOrders.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveQueueFilter('mine');
                setGlobalOrderSearch('');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                activeQueueFilter === 'mine' && !globalOrderSearch
                  ? 'bg-neutral-950 text-white shadow-xs font-bold'
                  : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
              }`}
            >
              <span>👤 My Assigned Bucket</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeQueueFilter === 'mine' && !globalOrderSearch ? 'bg-neutral-800 text-white' : 'bg-neutral-200 text-neutral-800'
              }`}>
                {myBucketOrders.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveQueueFilter('all');
                setGlobalOrderSearch('');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                activeQueueFilter === 'all' && !globalOrderSearch
                  ? 'bg-neutral-950 text-white shadow-xs font-bold'
                  : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
              }`}
            >
              <span>📋 All Orders Archive</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeQueueFilter === 'all' && !globalOrderSearch ? 'bg-neutral-800 text-white' : 'bg-neutral-200 text-neutral-700'
              }`}>
                {orders.length}
              </span>
            </button>
          </div>

          {onNavigateToTab && (
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => onNavigateToTab('admin_bucket')}
                className="text-[11px] font-semibold text-neutral-600 hover:text-neutral-900 hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                <span>Admin Bucket ({adminBucketCount})</span>
                <ChevronRight className="w-3 h-3 text-neutral-400" />
              </button>
              <span className="text-neutral-300">·</span>
              <button
                type="button"
                onClick={() => onNavigateToTab('staff_buckets')}
                className="text-[11px] font-semibold text-neutral-600 hover:text-neutral-900 hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                <span>Staff Buckets</span>
                <ChevronRight className="w-3 h-3 text-neutral-400" />
              </button>
            </div>
          )}
        </div>

        {/* Global Multi-Parameter Search Input */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            value={globalOrderSearch}
            onChange={(e) => setGlobalOrderSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && displayOrders.length > 0) {
                setSelectedDetailOrder(displayOrders[0]);
              }
            }}
            placeholder={`Search across ALL staff buckets by Order # (e.g. #${getBoutiqueOrderPrefix(settings.boutiqueName)}-2481 or 2481), Customer Name, Mobile Number, or UTR... [Press Enter to Open]`}
            className="w-full pl-10 pr-24 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50/70 text-xs sm:text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-hidden focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 transition"
          />
          {globalOrderSearch && (
            <button
              type="button"
              onClick={() => setGlobalOrderSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg text-xs font-medium text-neutral-500 hover:text-neutral-800 bg-neutral-200/70 hover:bg-neutral-200 transition cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {/* Multi-Parameter Search Tags & Count */}
        <div className="flex items-center justify-between gap-2 text-[11px] text-neutral-500 flex-wrap pt-0.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-neutral-600">Search all buckets:</span>
            <span className="px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-700 font-mono">Order #</span>
            <span className="px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-700">Customer Name</span>
            <span className="px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-700 font-mono">Mobile Number</span>
            <span className="px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-700 font-mono">UTR Number</span>
          </div>

          <div className="text-right">
            {globalOrderSearch.trim() ? (
              <span className="font-semibold text-amber-900 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                Found <strong>{displayOrders.length}</strong> {displayOrders.length === 1 ? 'order' : 'orders'} across all staff & admin buckets
              </span>
            ) : activeQueueFilter === 'unassigned' ? (
              <span className="font-semibold text-amber-900 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                Showing <strong>{displayOrders.length}</strong> unassigned {displayOrders.length === 1 ? 'order' : 'orders'} in intake queue
              </span>
            ) : activeQueueFilter === 'mine' ? (
              <span className="font-semibold text-blue-900 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                Showing <strong>{displayOrders.length}</strong> {displayOrders.length === 1 ? 'order' : 'orders'} in your bucket
              </span>
            ) : (
              <span className="text-neutral-500 font-medium">
                Showing all <strong>{displayOrders.length}</strong> orders history (newest first)
              </span>
            )}
          </div>
        </div>

        {/* Quick Open Match Banner on Search */}
        {globalOrderSearch.trim() && displayOrders.length > 0 && (
          <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-50 via-white to-amber-50/50 border border-amber-300 flex items-center justify-between gap-3 flex-wrap animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500 text-neutral-950 shrink-0">
                <Search className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-bold text-xs text-neutral-950 bg-white px-2 py-0.5 rounded border border-amber-200">
                    #{displayOrders[0].orderNumber}
                  </span>
                  <span className="font-bold text-neutral-900 text-xs">{displayOrders[0].customer.name}</span>
                  {displayOrders[0].assignedStaffName ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                      👤 In {displayOrders[0].assignedStaffName}'s Bucket ({displayOrders[0].assignedStaffId === 'admin' ? 'Store Owner / Admin' : 'Staff'})
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                      ⚠️ Unassigned (Intake Queue)
                    </span>
                  )}
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700">
                    Stage: {displayOrders[0].status}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  Mobile: {displayOrders[0].customer.phone} · Amount: {formatPrice(displayOrders[0].totalAmount)} · {displayOrders[0].items.length} {displayOrders[0].items.length === 1 ? 'saree' : 'sarees'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedDetailOrder(displayOrders[0])}
              className="px-4 py-2 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white font-bold text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer ml-auto"
            >
              <span>Open Order #{displayOrders[0].orderNumber} Workspace</span>
              <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
            </button>
          </div>
        )}
      </div>

      {/* Orders List */}
      {displayOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-200 p-10 text-center space-y-3">
          {globalOrderSearch.trim() ? (
            <>
              <div className="w-12 h-12 rounded-full bg-neutral-100 text-neutral-500 flex items-center justify-center mx-auto">
                <Search className="w-6 h-6" />
              </div>
              <p className="font-serif text-lg font-bold text-neutral-800">
                No orders match "{globalOrderSearch}"
              </p>
              <p className="text-xs text-neutral-500 max-w-md mx-auto">
                Check the order number (e.g. #{getBoutiqueOrderPrefix(settings.boutiqueName)}-4925 or 4925), customer name, 10-digit mobile, or 12-digit UTR.
              </p>
              <button
                onClick={() => setGlobalOrderSearch('')}
                className="mt-2 px-3.5 py-1.5 rounded-xl bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 transition cursor-pointer"
              >
                Clear Search
              </button>
            </>
          ) : activeQueueFilter === 'unassigned' ? (
            <>
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                <CheckCircle className="w-6 h-6" />
              </div>
              <p className="font-serif text-lg font-bold text-neutral-900">
                All Orders Assigned to Staff & Admin Buckets!
              </p>
              <p className="text-xs text-neutral-600 max-w-md mx-auto leading-relaxed">
                Once orders are assigned, they are automatically cleared from this Order Page intake queue and moved into their assigned staff or admin buckets.
                You can search by Order # above to open any assigned order here anytime.
              </p>
              <div className="flex items-center justify-center gap-2 pt-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setActiveQueueFilter('all')}
                  className="px-3.5 py-1.5 rounded-xl border border-neutral-300 text-neutral-800 text-xs font-semibold hover:bg-neutral-100 transition cursor-pointer"
                >
                  Browse All Orders Archive ({orders.length})
                </button>
                {onNavigateToTab && (
                  <>
                    <button
                      type="button"
                      onClick={() => onNavigateToTab('admin_bucket')}
                      className="px-3.5 py-1.5 rounded-xl bg-neutral-950 text-white text-xs font-bold hover:bg-neutral-800 transition shadow-xs cursor-pointer"
                    >
                      View Admin Bucket ({adminBucketCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigateToTab('staff_buckets')}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-500 text-neutral-950 text-xs font-bold hover:bg-amber-400 transition shadow-xs cursor-pointer"
                    >
                      View Staff Buckets
                    </button>
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="font-serif text-lg font-bold text-neutral-800">No orders in this view</p>
              <p className="text-xs text-neutral-500 mt-1">Customer orders will appear here as they are placed.</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Direct Access Bar */}
          <div className="flex items-center justify-between gap-3 text-xs text-neutral-600 px-1 py-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-neutral-900">
                {displayOrders.length} {displayOrders.length === 1 ? 'Order' : 'Orders'}
              </span>
              <span className="text-neutral-400">·</span>
              <span className="text-neutral-500 text-[11px]">
                Click any order or 'Inspect Status' to view complete details
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setExpandedOrderIds(new Set(displayOrders.map((o) => o.id)))}
                className="px-2.5 py-1 rounded-lg border border-neutral-300 hover:bg-neutral-100 text-neutral-700 font-medium text-[11px] transition flex items-center gap-1 cursor-pointer"
                title="Expand all orders"
              >
                <Maximize2 className="w-3 h-3 text-neutral-500" />
                <span>Expand All</span>
              </button>
              <button
                type="button"
                onClick={() => setExpandedOrderIds(new Set())}
                className="px-2.5 py-1 rounded-lg border border-neutral-300 hover:bg-neutral-100 text-neutral-700 font-medium text-[11px] transition flex items-center gap-1 cursor-pointer"
                title="Collapse all orders"
              >
                <Minimize2 className="w-3 h-3 text-neutral-500" />
                <span>Collapse All</span>
              </button>
            </div>
          </div>

          {displayOrders.map((order) => {
            const isCancelledOrRejected = order.status === 'Cancelled' || order.status === 'Rejected';
            const refundPending = isCancelledOrRejected && order.refundDetails?.refundStatus === 'pending';
            const isExpanded = expandedOrderIds.has(order.id);

            return (
              <div
                key={order.id}
                className={`bg-white rounded-2xl border transition shadow-xs overflow-hidden ${
                  refundPending
                    ? 'border-amber-400 bg-gradient-to-r from-amber-50/20 to-white'
                    : 'border-neutral-200/90'
                }`}
              >
                {/* Clickable Order Summary Header (User Request: clickable format to avoid lengthy scrolling) */}
                <div
                  onClick={() => toggleOrderExpand(order.id)}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 transition cursor-pointer select-none ${
                    isExpanded ? 'bg-neutral-50/90 border-b border-neutral-200' : 'hover:bg-neutral-50/70'
                  }`}
                  title="Click to expand/collapse order details"
                >
                  <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
                    <span
                      className={`p-1 rounded-md border transition ${
                        isExpanded ? 'bg-amber-100 border-amber-300 text-amber-900' : 'bg-neutral-100 border-neutral-200 text-neutral-500'
                      }`}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </span>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDetailOrder(order);
                      }}
                      className="font-mono text-xs font-bold text-rose-950 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-md border border-rose-200 transition cursor-pointer"
                      title="Click to open this order workspace"
                    >
                      #{order.orderNumber}
                    </span>
                    <span className="text-xs font-bold text-neutral-900">{order.customer.name}</span>
                    <span className="text-xs text-neutral-500 font-mono hidden md:inline">
                      {order.customer.phone}
                    </span>
                    <span className="text-xs text-neutral-400">·</span>
                    <span className="text-xs font-medium text-neutral-600">
                      {order.items.length} {order.items.length === 1 ? 'saree' : 'sarees'}
                    </span>
                    <span className="font-bold text-neutral-900 tabular-nums">
                      {formatPrice(order.totalAmount)}
                    </span>
                    <span className="text-xs text-neutral-400 hidden sm:inline">·</span>
                    <span className="text-xs text-neutral-500 hidden sm:inline">
                      {new Date(order.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {order.assignedStaffName ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                        👤 Moved to: {order.assignedStaffName} ({order.assignedStaffId === 'admin' ? 'Admin' : 'Staff'})
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                        ⚠️ Unassigned
                      </span>
                    )}

                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        order.status === 'Cancelled' || order.status === 'Rejected'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : order.status === 'Delivered'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : order.status === 'Shipped'
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : order.status === 'Confirmed'
                          ? 'bg-purple-100 text-purple-800 border border-purple-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {order.status}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDetailOrder(order);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white font-bold text-xs transition shadow-xs cursor-pointer flex items-center gap-1.5"
                      title="Open complete Order Workspace"
                    >
                      <span>Open Order</span>
                      <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                    </button>
                    {canEditOrders && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingOrder(order);
                          setDeleteRestockItems(order.status !== 'Cancelled' && order.status !== 'Delivered' && !order.isRestocked);
                          setDeleteReasonNote(order.status === 'Delivered' || order.isClosed ? 'Clean up completed / closed order' : '');
                        }}
                        className="p-1.5 rounded-xl border border-neutral-200 hover:border-rose-300 hover:bg-rose-50 text-neutral-400 hover:text-rose-700 transition cursor-pointer"
                        title={`Delete / Remove Order #${order.orderNumber}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <span className="text-[11px] font-semibold text-neutral-600 bg-neutral-100 px-2 py-1 rounded-md">
                      {isExpanded ? 'Hide ▲' : 'Inline ▼'}
                    </span>
                  </div>
                </div>

                {/* Expanded Details Body */}
                {isExpanded && (
                  <div className="p-4 sm:p-5 pt-3 space-y-4">
                    {/* Header row with Stage Switcher */}
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

                  {/* Delivered Stage: Close Order Trigger & Realized Status */}
                  {order.status === 'Delivered' && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {order.isClosed ? (
                        <div className="flex items-center gap-1.5">
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-950 text-emerald-300 text-[11px] font-bold flex items-center gap-1 border border-emerald-800">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Closed & Realized in Analytics</span>
                          </span>
                          {canEditOrders && (
                            <button
                              type="button"
                              onClick={() => {
                                const reason = prompt('Reason for reopening this delivered order:');
                                if (reason && reason.trim()) {
                                  reopenOrder(order.id, currentUserName, reason.trim());
                                }
                              }}
                              className="px-2 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-[10px] font-bold border border-amber-300 transition cursor-pointer"
                              title="Reopen order (immediately deducts units and revenue from sales analytics in real time)"
                            >
                              Reopen
                            </button>
                          )}
                        </div>
                      ) : (
                        canEditOrders && (
                          <button
                            type="button"
                            onClick={() => closeOrder(order.id, currentUserName)}
                            className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer"
                            title="Close delivered order and commit units sold & revenue to sales analytics"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Mark Delivered & Close Order</span>
                          </button>
                        )
                      )}
                    </div>
                  )}

                  {/* Dedicated Order Removal Button for Staff and Admins */}
                  {canEditOrders && (
                    <button
                      type="button"
                      onClick={() => {
                        setDeletingOrder(order);
                        setDeleteRestockItems(order.status !== 'Cancelled' && order.status !== 'Delivered' && !order.isRestocked);
                        setDeleteReasonNote(order.status === 'Delivered' || order.isClosed ? 'Clean up completed / closed order' : '');
                      }}
                      className="px-2.5 py-1 rounded-lg border border-rose-200 hover:border-rose-300 bg-rose-50/70 hover:bg-rose-100 text-rose-800 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                      title="Remove this order record from active view and database"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>Delete Order</span>
                    </button>
                  )}
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

                    {/* Assigned Staff Member & Live Work Tracking (User Request) */}
                    <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200/90 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[11px] text-neutral-700 block uppercase tracking-wider flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5 text-amber-600" />
                          <span>Handling Staff:</span>
                        </span>
                        {order.assignedStaffName ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                            👤 {order.assignedStaffName}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                            ⚠️ Unassigned
                          </span>
                        )}
                      </div>

                      {/* Interactive Assignment Buttons for Staff & Admins */}
                      {canEditOrders && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          {/* Claim button for current user (Admin needs no reason, staff must provide reason) */}
                          {currentUser && order.assignedStaffId !== (currentUser.staffId || 'admin') && (
                            <button
                              type="button"
                              onClick={() => {
                                const myId = currentUser.staffId || 'admin';
                                const myName = currentUser.name || (isAdmin ? 'Store Owner' : 'Staff Concierge');
                                if (isAdmin) {
                                  assignOrderStaff(order.id, myId, myName, 'Claimed by Store Owner');
                                } else {
                                  setAssignModalOrder(order);
                                  setTargetStaffId(myId);
                                  setAssignmentReason('');
                                }
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-[11px] transition shadow-2xs flex items-center gap-1 cursor-pointer"
                              title="Assign this order to yourself and begin working"
                            >
                              <UserCheck className="w-3 h-3" />
                              <span>Assign to Me</span>
                            </button>
                          )}

                          {/* Reassign / Assign Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setAssignModalOrder(order);
                              setTargetStaffId(order.assignedStaffId || (staffMembers[0]?.id || ''));
                              setAssignmentReason('');
                            }}
                            className="px-2.5 py-1.5 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-800 font-semibold text-[11px] transition shadow-2xs flex items-center gap-1 cursor-pointer"
                          >
                            <UserPlus className="w-3 h-3 text-neutral-600" />
                            <span>{order.assignedStaffId ? 'Reassign Staff' : 'Assign Staff'}</span>
                          </button>

                          {/* Add Work Note / Tracking button */}
                          <button
                            type="button"
                            onClick={() => {
                              setWorkLogModalOrder(order);
                              setWorkLogAction('Working on order');
                              setWorkLogNote('');
                            }}
                            className="px-2 py-1.5 rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60 text-[11px] font-medium transition flex items-center gap-1 ml-auto"
                            title="Add progress or status note"
                          >
                            <Edit className="w-3 h-3" />
                            <span>Add Note</span>
                          </button>
                        </div>
                      )}

                      {/* Live Staff Work Tracking Timeline (User Request) */}
                      <div className="pt-2 border-t border-neutral-200/80">
                        <div className="flex items-center justify-between text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1.5">
                          <span className="flex items-center gap-1">
                            <History className="w-3 h-3 text-neutral-400" />
                            <span>Live Work & Assignment Log:</span>
                          </span>
                          <span className="font-mono">{(order.assignmentHistory || []).length} logs</span>
                        </div>

                        {order.assignmentHistory && order.assignmentHistory.length > 0 ? (
                          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                            {order.assignmentHistory.map((log, idx) => (
                              <div
                                key={log.id || idx}
                                className="p-2 rounded-xl bg-white border border-neutral-200 text-[11px] space-y-0.5 shadow-2xs"
                              >
                                <div className="flex items-center justify-between text-[10px] text-neutral-400 font-mono">
                                  <span className="font-bold text-neutral-700">👤 {log.staffName}</span>
                                  <span>{new Date(log.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                <p className="font-semibold text-neutral-900 text-[11px] leading-tight">
                                  {log.action}
                                </p>
                                {log.note && (
                                  <p className="text-[10px] text-neutral-600 italic bg-neutral-50 px-1.5 py-0.5 rounded border border-neutral-100">
                                    "{log.note}"
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[10px] text-neutral-400 italic">
                            No assignment history recorded yet. Click 'Assign to Me' or 'Assign Staff' to start work tracking.
                          </p>
                        )}
                      </div>
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
                            src={item.product.images[0] || '/assets/images/hero_saree_atelier_1791651761357.jpg'}
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

                    {/* Live Customer Chat & Stage WhatsApp Update Buttons */}
                    <div className="pt-2 border-t border-neutral-200 space-y-1.5">
                      {/* Live Customer Chat Stream (User Request 3) */}
                      <button
                        type="button"
                        onClick={() => setLiveChatOrder(order)}
                        className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-2xs cursor-pointer"
                        title="Chat in real time with customer regarding this order"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-white" />
                        <span>
                          Live Chat with Customer
                          {order.chatMessages && order.chatMessages.length > 0 ? ` (${order.chatMessages.length})` : ''}
                        </span>
                        {order.chatMessages?.some((m) => !m.readByStaff && m.sender === 'customer') && (
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-1" />
                        )}
                      </button>

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
            )}
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
                <p>Customer: <strong>{refundModalOrder.customer.name}</strong> ({refundModalOrder.customer.phone})</p>
                <p>Refund UPI ID: <strong>{refundModalOrder.refundDetails?.refundUpiId || 'Check WhatsApp chat'}</strong></p>
                <p>Refund Phone: <strong>{refundModalOrder.refundDetails?.refundUpiPhone || refundModalOrder.customer.phone}</strong></p>
                <p>Total to Refund: <strong className="text-rose-900 font-serif text-sm">{formatPrice(refundModalOrder.totalAmount)}</strong></p>
              </div>

              {/* Requirement 3: Transaction Tool Used */}
              <div>
                <label className="block font-bold text-neutral-800 mb-1">
                  Transaction Tool Used *
                </label>
                <select
                  value={refundTool}
                  onChange={(e) => setRefundTool(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white font-medium text-xs text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40"
                >
                  <option value="PhonePe">PhonePe</option>
                  <option value="Google Pay (GPay)">Google Pay (GPay)</option>
                  <option value="Paytm">Paytm</option>
                  <option value="BHIM UPI">BHIM UPI</option>
                  <option value="NetBanking / IMPS">NetBanking / IMPS</option>
                  <option value="Bank Transfer (NEFT/RTGS)">Bank Transfer (NEFT/RTGS)</option>
                  <option value="Other Banking Tool">Other Banking Tool</option>
                </select>
                <p className="text-[11px] text-neutral-500 mt-1">
                  Select payment application used to transfer the refund amount.
                </p>
              </div>

              {/* Requirement 3: 12-digit numeric validation UTR */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-neutral-800">
                    Bank Refund UTR Number * (12 Digits)
                  </label>
                  <span className={`text-[11px] font-mono font-bold ${
                    refundUtr.length === 12 ? 'text-emerald-600' : 'text-neutral-400'
                  }`}>
                    {refundUtr.length}/12 digits
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={12}
                  value={refundUtr}
                  onChange={(e) => {
                    const digitsOnly = e.target.value.replace(/[^0-9]/g, '').slice(0, 12);
                    setRefundUtr(digitsOnly);
                    if (digitsOnly.length === 12) {
                      setRefundUtrError(null);
                    }
                  }}
                  required
                  placeholder="e.g. 402819283741"
                  className={`w-full p-2.5 rounded-xl border font-mono text-sm tracking-widest text-neutral-900 focus:outline-hidden ${
                    refundUtrError
                      ? 'border-rose-500 focus:ring-2 focus:ring-rose-500/40 bg-rose-50/30'
                      : 'border-neutral-300 focus:ring-2 focus:ring-amber-500/40'
                  }`}
                />
                {refundUtrError && (
                  <p className="text-[11px] text-rose-600 font-semibold mt-1">
                    {refundUtrError}
                  </p>
                )}
                <p className="text-[11px] text-neutral-500 mt-1">
                  This 12-digit bank UTR will be recorded on the order, updated in the tracking page, and automatically attached to resolve any open customer dispute.
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
                  placeholder={`e.g. Refunded to customer UPI via ${refundTool}`}
                  className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-[11px] space-y-0.5">
                <p className="font-bold">Automatic Status & Dispute Resolution:</p>
                <p>
                  Submitting will mark the order as <strong>Refunded</strong> and automatically resolve any open customer refund dispute with these attached transaction details.
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRefundModalOrder(null)}
                  className="px-4 py-2 rounded-xl border border-neutral-300 text-neutral-700 font-semibold cursor-pointer hover:bg-neutral-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={refundUtr.length !== 12}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition shadow-xs"
                >
                  Confirm & Mark as Refunded
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Automated Order Message Dispatcher & Dynamic Variable Editor Modal (User Request) */}
      {messageModalOrder && (() => {
        const dynamicVariables = getOrderDynamicVariables(messageModalOrder, settings);
        const filteredVars = messageModalCategory === 'all'
          ? dynamicVariables
          : dynamicVariables.filter((v) => v.category === messageModalCategory);

        return (
          <div className="fixed inset-0 z-60 overflow-y-auto bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
            <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-200 my-auto flex flex-col max-h-[92vh]">
              {/* Modal Header */}
              <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-950 via-neutral-900 to-emerald-900 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <MessageSquare className="w-5 h-5 fill-emerald-400 text-emerald-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-serif text-base sm:text-lg font-bold text-white">
                        Automated Order Status Message
                      </h3>
                      <span className="font-mono text-xs font-bold text-amber-300 bg-amber-950/60 border border-amber-500/40 px-2 py-0.5 rounded">
                        #{messageModalOrder.orderNumber}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-300 mt-0.5 flex items-center gap-2 flex-wrap">
                      <span>Customer: <strong className="text-white">{messageModalOrder.customer.name}</strong> ({messageModalOrder.customer.phone})</span>
                      <span>·</span>
                      <span>Current Order Stage: <strong className="text-amber-400">{messageModalOrder.status}</strong></span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setMessageModalOrder(null)}
                  className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Modal Content */}
              <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
                {/* Stage Template Selector Tabs */}
                <div className="bg-neutral-50 rounded-2xl p-3 border border-neutral-200 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-600 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      <span>Select Base Stage Template:</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleResetModalMessageToTemplate}
                      className="inline-flex items-center gap-1 text-[11px] text-neutral-600 hover:text-neutral-900 font-semibold"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Revert Edits to Default</span>
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled', 'Rejected'] as OrderStatus[]).map(
                      (st) => {
                        const isActive = messageModalStage === st;
                        return (
                          <button
                            key={st}
                            type="button"
                            onClick={() => handleSwitchMessageModalStage(st)}
                            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition flex items-center gap-1.5 ${
                              isActive
                                ? 'bg-neutral-900 text-white shadow-xs'
                                : 'bg-white hover:bg-neutral-200/70 text-neutral-700 border border-neutral-200'
                            }`}
                          >
                            <span>{st}</span>
                            {messageModalOrder.status === st && (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Current Order Status" />
                            )}
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>

                {/* Dynamic Order Variables Palette (User Request) */}
                <div className="bg-amber-500/10 rounded-2xl p-3.5 border border-amber-500/30 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-amber-950 text-xs flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                        <span>Dynamic Variables from Customer Order</span>
                      </h4>
                      <p className="text-[11px] text-amber-900/80 mt-0.5">
                        Click any chip to insert its dynamic customer value or token into your message.
                      </p>
                    </div>

                    {/* Filter categories */}
                    <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                      {(
                        [
                          { key: 'all', label: 'All' },
                          { key: 'essential', label: 'Essential (Tracking/UTR)' },
                          { key: 'customer', label: 'Customer' },
                          { key: 'shipping', label: 'Shipping' },
                          { key: 'refund', label: 'Refund' },
                          { key: 'store', label: 'Store' },
                        ] as const
                      ).map((cat) => (
                        <button
                          key={cat.key}
                          type="button"
                          onClick={() => setMessageModalCategory(cat.key)}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold whitespace-nowrap transition ${
                            messageModalCategory === cat.key
                              ? 'bg-amber-800 text-white'
                              : 'bg-white/80 text-amber-950 hover:bg-white'
                          }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Variables Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-44 overflow-y-auto p-1">
                    {filteredVars.map((v) => (
                      <div
                        key={v.token}
                        className="p-2 rounded-xl bg-white border border-amber-200/80 shadow-2xs hover:border-amber-400 transition flex flex-col justify-between group"
                      >
                        <div className="flex items-start justify-between gap-1">
                          <span className="font-mono text-[10px] font-bold text-amber-900 truncate">
                            {v.token}
                          </span>
                          <span className="text-[9px] uppercase font-semibold text-neutral-400 shrink-0">
                            {v.label}
                          </span>
                        </div>
                        <p className="text-[11px] font-medium text-neutral-800 truncate mt-1" title={v.value}>
                          {v.value || <span className="italic text-neutral-400 font-normal">None</span>}
                        </p>
                        <div className="mt-1.5 pt-1 border-t border-neutral-100 flex items-center justify-between gap-1">
                          <button
                            type="button"
                            onClick={() => handleInsertDynamicVariable(v.value)}
                            className="text-[10px] font-bold text-emerald-800 hover:text-emerald-950 hover:underline"
                            title={`Insert evaluated value "${v.value}"`}
                          >
                            + Insert Value
                          </button>
                          <button
                            type="button"
                            onClick={() => handleInsertDynamicVariable(v.token)}
                            className="text-[10px] text-neutral-500 hover:text-neutral-900"
                            title={`Insert token placeholder ${v.token}`}
                          >
                            + Token
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Editable Message Textarea */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-neutral-900 text-xs">
                      Editable Message for Customer:
                    </label>
                    <span className="text-[10px] text-neutral-500 font-mono">
                      {messageModalText.length} characters · ~{Math.ceil(messageModalText.split(/\s+/).filter(Boolean).length)} words
                    </span>
                  </div>

                  <textarea
                    ref={messageTextareaRef}
                    rows={8}
                    value={messageModalText}
                    onChange={(e) => {
                      setMessageModalText(e.target.value);
                      handleSaveMessageSelection();
                    }}
                    onSelect={handleSaveMessageSelection}
                    onClick={handleSaveMessageSelection}
                    onKeyUp={handleSaveMessageSelection}
                    placeholder="Enter or customize the automated notification..."
                    className="w-full p-3.5 rounded-2xl border border-neutral-300 font-mono text-xs text-neutral-900 bg-white leading-relaxed focus:outline-hidden focus:ring-2 focus:ring-emerald-500/40 shadow-inner"
                  />
                  <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-0.5">
                    <span className="italic">
                      Tip: Edits here are specific to this single customer order before dispatching on WhatsApp.
                    </span>
                    <span className="font-mono text-[10px]">
                      WhatsApp format: *bold*, _italic_, ~strike~
                    </span>
                  </div>
                </div>

                {/* WhatsApp Chat Preview Simulation */}
                <div className="bg-neutral-100 rounded-2xl p-3.5 border border-neutral-200 space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-neutral-600 font-semibold border-b border-neutral-200/80 pb-1.5">
                    <span className="flex items-center gap-1.5 text-emerald-800 font-bold">
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>WhatsApp Customer Preview:</span>
                    </span>
                    <span className="text-neutral-500 font-mono text-[10px]">Recipient: {messageModalOrder.customer.phone}</span>
                  </div>

                  <div className="bg-[#e5ddd5] p-3 rounded-xl border border-neutral-300 overflow-x-hidden">
                    <div className="max-w-md ml-auto bg-[#dcf8c6] text-neutral-950 p-3 rounded-2xl rounded-tr-xs shadow-xs text-xs whitespace-pre-wrap font-sans leading-relaxed">
                      {messageModalText}
                      <div className="mt-1 flex items-center justify-end gap-1 text-[9px] text-neutral-500 font-mono">
                        <span>{new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="text-blue-600 font-bold">✓✓</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Order Status Synchronization Option */}
                {messageModalOrder.status !== messageModalStage && (
                  <label className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={updateOrderStatusOnSend}
                      onChange={(e) => setUpdateOrderStatusOnSend(e.target.checked)}
                      className="rounded text-amber-600 w-4 h-4"
                    />
                    <div>
                      <span className="font-bold block">
                        Also update order stage from "{messageModalOrder.status}" to "{messageModalStage}" in boutique records
                      </span>
                      <span className="text-[11px] text-amber-800 font-normal">
                        Syncs the new status to the order database when sending this notification.
                      </span>
                    </div>
                  </label>
                )}
              </div>

              {/* Modal Footer Actions */}
              <div className="p-4 sm:p-5 bg-neutral-50 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyModalMessage}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-800 font-semibold text-xs transition flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  {messageModalCopied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span className="text-emerald-700">Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-neutral-600" />
                      <span>Copy Message</span>
                    </>
                  )}
                </button>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setMessageModalOrder(null)}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-neutral-300 text-neutral-700 hover:bg-neutral-100 font-semibold text-xs transition"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleSendCustomWhatsApp}
                    className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2"
                  >
                    <MessageSquare className="w-4 h-4 fill-white" />
                    <span>Send on WhatsApp</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Google Sheets Sync Confirmation Dialog */}
      {isConfirmSyncOpen && (
        <div className="fixed inset-0 z-60 overflow-y-auto bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 my-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 bg-emerald-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-serif text-base font-bold text-white">
                    Sync Orders to Google Sheets
                  </h3>
                  <p className="text-[11px] text-emerald-300">
                    Export boutique orders log to Google Drive
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsConfirmSyncOpen(false)}
                className="p-1 rounded-full text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-neutral-700">
              <p className="leading-relaxed">
                You are about to export and synchronize <strong className="text-neutral-900 font-bold">{orders.length} orders</strong> directly into your Google Sheets spreadsheet.
              </p>
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900 space-y-1">
                <p className="font-semibold">What will happen:</p>
                <ul className="list-disc list-inside space-y-0.5 text-emerald-800">
                  <li>Creates or updates the &ldquo;Orders Log&rdquo; spreadsheet on your Google Drive.</li>
                  <li>Writes columns for Order numbers, customer details, payment UTRs, and delivery status.</li>
                  <li>Overwrites older rows to maintain clean data synchronization.</li>
                </ul>
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsConfirmSyncOpen(false)}
                  className="px-4 py-2 rounded-xl border border-neutral-300 text-neutral-700 font-semibold hover:bg-neutral-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSyncSheets}
                  className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold transition shadow-xs flex items-center gap-1.5"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Confirm & Sync</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Staff Assignment & Handover Modal (User Request: Reassignment e.g. Emergency Leave) */}
      {assignModalOrder && (
        <div className="fixed inset-0 z-60 overflow-y-auto bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 my-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 bg-neutral-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <UserPlus className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-serif text-base font-bold text-white">
                    {assignModalOrder.assignedStaffId ? 'Reassign Boutique Staff' : 'Assign Boutique Staff'}
                  </h3>
                  <p className="text-[11px] text-neutral-400 font-mono">
                    Order #{assignModalOrder.orderNumber}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAssignModalOrder(null)}
                className="p-1 rounded-full text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-neutral-800 mb-1">
                  Select Staff Member to Assign *
                </label>
                <select
                  value={targetStaffId}
                  onChange={(e) => setTargetStaffId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white text-neutral-900 font-medium"
                >
                  <option value="">-- Choose Staff Member --</option>
                  {staffMembers.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name} (@{staff.username}) · {staff.role} {staff.isLocked ? '[Locked]' : ''}
                    </option>
                  ))}
                  {isAdmin && (
                    <option value="admin">
                      Store Owner / Master Administrator
                    </option>
                  )}
                </select>
              </div>

              <div>
                <label className="block font-bold text-neutral-800 mb-1 flex items-center justify-between">
                  <span>Assignment / Handover Reason</span>
                  {isAdmin ? (
                    <span className="text-[11px] font-normal text-neutral-400">Optional for Admin</span>
                  ) : (
                    <span className="text-[11px] font-bold text-rose-600">* Required for Staff</span>
                  )}
                </label>
                <input
                  type="text"
                  required={!isAdmin}
                  value={assignmentReason}
                  onChange={(e) => setAssignmentReason(e.target.value)}
                  placeholder={
                    isAdmin
                      ? 'Optional note (e.g. VIP bridal priority, weaver verification)'
                      : 'Required: state reason for assignment (e.g. emergency leave handover, shift duty)'
                  }
                  className={`w-full p-2.5 rounded-xl border bg-white text-neutral-900 ${
                    !isAdmin && !assignmentReason.trim() ? 'border-amber-400 focus:border-rose-500' : 'border-neutral-300'
                  }`}
                />
                {!isAdmin && (
                  <p className="text-[10px] text-neutral-500 mt-1">
                    * Assignee must state why this order is being claimed or reassigned.
                  </p>
                )}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap text-[10px]">
                  <span className="text-neutral-400 font-semibold">Quick Presets:</span>
                  {[
                    'Emergency leave handover',
                    'Shift change handover',
                    'Bridal VIP priority handling',
                    'Weaver verification assigned',
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAssignmentReason(preset)}
                      className="px-2 py-0.5 rounded-md bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-neutral-200 transition"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
                ℹ️ All order assignments and reassignments are recorded with live timestamps and staff names in the order's tracking ledger and Google Sheets sync.
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setAssignModalOrder(null)}
                  className="px-4 py-2.5 rounded-xl border border-neutral-300 text-neutral-700 font-semibold hover:bg-neutral-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!targetStaffId) {
                      alert('Please select a staff member to assign.');
                      return;
                    }
                    if (!isAdmin && !assignmentReason.trim()) {
                      alert('Please state a reason for assigning or reassigning the order. Staff members must record an assignment reason.');
                      return;
                    }
                    const selectedStaff = staffMembers.find((s) => s.id === targetStaffId);
                    const sName = targetStaffId === 'admin'
                      ? 'Store Owner'
                      : (selectedStaff?.name || 'Staff Specialist');
                    const finalReason = assignmentReason.trim() || (isAdmin ? 'Assigned by Store Owner' : 'Assigned to staff');
                    assignOrderStaff(assignModalOrder.id, targetStaffId, sName, finalReason);
                    setAssignmentToast({
                      orderNumber: assignModalOrder.orderNumber,
                      staffName: sName,
                      staffId: targetStaffId,
                    });
                    setAssignModalOrder(null);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white font-bold transition shadow-xs flex items-center gap-1.5"
                >
                  <UserCheck className="w-4 h-4 text-amber-400" />
                  <span>Confirm Assignment</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Work Note Log Modal */}
      {workLogModalOrder && (
        <div className="fixed inset-0 z-60 overflow-y-auto bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 my-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 bg-neutral-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <History className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-serif text-base font-bold text-white">
                    Add Live Work Tracking Update
                  </h3>
                  <p className="text-[11px] text-neutral-400 font-mono">
                    Order #{workLogModalOrder.orderNumber}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setWorkLogModalOrder(null)}
                className="p-1 rounded-full text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-neutral-800 mb-1">
                  Action Headline *
                </label>
                <input
                  type="text"
                  value={workLogAction}
                  onChange={(e) => setWorkLogAction(e.target.value)}
                  placeholder="e.g. Saree fabric quality inspection verified"
                  className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white text-neutral-900"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-800 mb-1">
                  Work Progress Notes (Optional)
                </label>
                <textarea
                  rows={3}
                  value={workLogNote}
                  onChange={(e) => setWorkLogNote(e.target.value)}
                  placeholder="e.g. Verified mulberry silk mark certificate, packed in velvet heirloom bag"
                  className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white text-neutral-900 resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setWorkLogModalOrder(null)}
                  className="px-4 py-2.5 rounded-xl border border-neutral-300 text-neutral-700 font-semibold hover:bg-neutral-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!workLogAction.trim()) return;
                    addOrderWorkLog(workLogModalOrder.id, workLogAction.trim(), workLogNote.trim());
                    setWorkLogModalOrder(null);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white font-bold transition shadow-xs flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Log Work Update</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mandatory Assignment Prompt Modal before stage changes (User Request 5 & Confirmed Choice) */}
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

      {/* Live Order Chat Modal for Staff/Admin (User Request 3) */}
      {liveChatOrder && (
        <div className="fixed inset-0 z-60 overflow-y-auto bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 my-auto">
            <div className="p-4 bg-neutral-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  <MessageSquare className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-serif text-base font-bold text-white">
                    Customer Live Chat · #{liveChatOrder.orderNumber}
                  </h3>
                  <p className="text-[11px] text-neutral-400">
                    Customer: {liveChatOrder.customer.name} ({liveChatOrder.customer.phone})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setLiveChatOrder(null)}
                className="p-1 rounded-full text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4">
              <OrderLiveChat
                order={orders.find((o) => o.id === liveChatOrder.id) || liveChatOrder}
                mode="admin"
                title={`Order #${liveChatOrder.orderNumber} Live Chat`}
              />
            </div>
          </div>
        </div>
      )}
      {/* Selected Order Details Modal (Cross-Bucket Clickable Results) */}
      {selectedDetailOrder && (
        <div className="fixed inset-0 z-60 overflow-y-auto bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-200 my-auto max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-neutral-950 via-neutral-900 to-rose-950 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-sm text-rose-300 bg-rose-950/80 px-2.5 py-1 rounded-lg border border-rose-500/40">
                  #{selectedDetailOrder.orderNumber}
                </span>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-serif text-base sm:text-lg font-bold text-white flex items-center gap-2">
                      <span>Order Workspace</span>
                    </h3>
                    {(isCancellationCase(selectedDetailOrder) || isRefundCase(selectedDetailOrder) || isDeliveryCase(selectedDetailOrder)) && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-rose-500 text-white flex items-center gap-1 shadow-2xs">
                        <AlertCircle className="w-3 h-3 text-white" />
                        <span>
                          {isCancellationCase(selectedDetailOrder)
                            ? 'Cancellation Request'
                            : isRefundCase(selectedDetailOrder)
                            ? 'Refund Dispute'
                            : 'Delivery Dispute'}
                        </span>
                      </span>
                    )}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      selectedDetailOrder.status === 'Refunded'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : selectedDetailOrder.status === 'Cancelled'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : selectedDetailOrder.status === 'Confirmed'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                        : selectedDetailOrder.status === 'Shipped'
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                        : selectedDetailOrder.status === 'Delivered'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}>
                      Stage: {selectedDetailOrder.status}
                    </span>
                    {selectedDetailOrder.deliveryIssue?.status && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        selectedDetailOrder.deliveryIssue.status === 'open'
                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                          : selectedDetailOrder.deliveryIssue.status === 'investigating'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      }`}>
                        Dispute: {selectedDetailOrder.deliveryIssue.status}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Customer: {selectedDetailOrder.customer.name} ({selectedDetailOrder.customer.phone}) · Placed: {new Date(selectedDetailOrder.createdAt).toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetailOrder(null)}
                className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-5 sm:p-6 space-y-5 overflow-y-auto text-xs text-neutral-700 flex-1">
              {/* Handling Concierge / Bucket Info & Claim/Reassign Bar */}
              <div className="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200 flex items-center justify-between flex-wrap gap-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-neutral-600">Handling Bucket:</span>
                  <span className="font-bold text-neutral-900 bg-white px-2.5 py-1 rounded-lg border border-neutral-200 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-amber-600" />
                    <span>
                      {!selectedDetailOrder.assignedStaffId || selectedDetailOrder.assignedStaffId === 'unassigned'
                        ? 'Unassigned Intake Queue (Needs Owner)'
                        : selectedDetailOrder.assignedStaffId === 'admin'
                        ? 'Store Owner / Admin Bucket'
                        : `Staff Bucket: ${selectedDetailOrder.assignedStaffName || 'Specialist'}`}
                    </span>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Claim Button */}
                  {selectedDetailOrder.assignedStaffId !== currentUserId && (
                    <button
                      type="button"
                      onClick={() => {
                        assignOrderStaff(
                          selectedDetailOrder.id,
                          currentUserId,
                          currentUserName,
                          'Claimed order into personal handling bucket'
                        );
                        setSelectedDetailOrder({
                          ...selectedDetailOrder,
                          assignedStaffId: currentUserId,
                          assignedStaffName: currentUserName,
                        });
                      }}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition shadow-2xs flex items-center gap-1 cursor-pointer"
                    >
                      <UserPlus className="w-3 h-3" />
                      <span>Assign to Me</span>
                    </button>
                  )}

                  {/* Reassign Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setAssignModalOrder(selectedDetailOrder);
                      setTargetStaffId(selectedDetailOrder.assignedStaffId || 'admin');
                      setAssignmentReason('');
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-neutral-100 text-neutral-800 border border-neutral-300 font-semibold text-xs transition cursor-pointer"
                  >
                    <span>Reassign</span>
                  </button>
                </div>
              </div>

              {/* SECTION: TAILORED DISPUTE WORKFLOWS */}
              {/* 1. Cancellation Request Workflow */}
              {isCancellationCase(selectedDetailOrder) && (
                <div className="p-4 rounded-2xl bg-rose-50/80 border border-rose-200 text-rose-950 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Ban className="w-4 h-4 text-rose-600 shrink-0" />
                      <h4 className="font-bold text-xs uppercase tracking-wider text-rose-900">
                        Customer Cancellation Request Workflow
                      </h4>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      selectedDetailOrder.cancellationRequest?.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : selectedDetailOrder.cancellationRequest?.status === 'rejected'
                        ? 'bg-neutral-100 text-neutral-700'
                        : 'bg-rose-100 text-rose-900 border border-rose-300 animate-pulse'
                    }`}>
                      Request Status: {selectedDetailOrder.cancellationRequest?.status || 'Pending Review'}
                    </span>
                  </div>

                  <div className="bg-white/90 p-3 rounded-xl border border-rose-200/80 space-y-1.5">
                    <p className="text-neutral-700">
                      <strong>Cancellation Reason:</strong> "{selectedDetailOrder.cancellationRequest?.reason || selectedDetailOrder.cancellationReason || 'Customer requested cancellation'}"
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-neutral-600 pt-1">
                      <p>Customer Phone: <strong className="text-neutral-900">{selectedDetailOrder.customer.phone}</strong></p>
                      <p>Refund Target UPI: <strong className="text-neutral-900">{selectedDetailOrder.refundDetails?.refundUpiId || selectedDetailOrder.customer.phone}</strong></p>
                      <p>Amount to Settle: <strong className="text-rose-900">{formatPrice(selectedDetailOrder.totalAmount)}</strong></p>
                    </div>
                  </div>

                  {/* Actions for Cancellation: Approve & Restock or Reject */}
                  {selectedDetailOrder.status !== 'Cancelled' && selectedDetailOrder.status !== 'Refunded' && (
                    <div className="pt-2 border-t border-rose-200 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => {
                            setCancellationApproveOrder(selectedDetailOrder);
                            setCancellationApproveUtr(
                              selectedDetailOrder.refundDetails?.refundUtr ||
                                `UTR${Math.floor(100000000000 + Math.random() * 900000000000)}`
                            );
                            setCancellationApproveTool(selectedDetailOrder.refundDetails?.refundTool || 'UPI Banking');
                            setCancellationApproveUpiTarget(
                              selectedDetailOrder.refundDetails?.refundUpiId || selectedDetailOrder.customer.phone
                            );
                            setCancellationApproveNotes(
                              'Cancellation approved by concierge. Saree auto-restocked to inventory.'
                            );
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Approve Cancellation & Issue Refund (Auto-Restock)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setCancellationDeclineOrder(selectedDetailOrder);
                            setCancellationDeclineReason(
                              'Saree has already been packed and handed over to courier dispatch'
                            );
                          }}
                          className="px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 font-semibold text-xs transition cursor-pointer flex items-center gap-1"
                        >
                          <Ban className="w-3.5 h-3.5 text-rose-600" />
                          <span>Decline Request</span>
                        </button>
                      </div>

                      <span className="text-[11px] text-neutral-500 italic">
                        * Approving automatically returns sarees to live inventory pool and flags them as Restocked.
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* 2. Delivery Dispute Workflow */}
              {isDeliveryCase(selectedDetailOrder) && (() => {
                const courier = getCourierDetails(selectedDetailOrder.shippingDetails?.courierName);
                return (
                  <div className="p-4 rounded-2xl bg-rose-50/80 border border-rose-200 text-rose-950 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-rose-600 shrink-0" />
                        <h4 className="font-bold text-xs uppercase tracking-wider text-rose-900">
                          Customer Non-Delivery Dispute & Courier Coordination
                        </h4>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 uppercase">
                        Dispute Status: {selectedDetailOrder.deliveryIssue?.status || 'open'}
                      </span>
                    </div>

                    <div className="bg-white/90 p-3 rounded-xl border border-rose-200/80 space-y-1">
                      <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">Customer Grievance Statement:</span>
                      <p className="text-xs font-medium text-rose-950 leading-relaxed italic">
                        "{selectedDetailOrder.deliveryIssue?.issueDescription || 'Customer dispute logged for concierge investigation.'}"
                      </p>
                    </div>

                    {/* Integrated Courier Logistics Panel (Address, Phone, Email, Consignment #, Maps Link, and Tracking Link) */}
                    <CourierLogisticsPanel
                      courierName={selectedDetailOrder.shippingDetails?.courierName}
                      trackingNumber={selectedDetailOrder.shippingDetails?.trackingNumber}
                      configuredCouriers={settings.courierServices}
                      customerCity={selectedDetailOrder.customer.city}
                      customerState={selectedDetailOrder.customer.state}
                      customerName={selectedDetailOrder.customer.name}
                      orderNumber={selectedDetailOrder.orderNumber}
                      variant="dispute"
                    />
                  </div>
                );
              })()}

              {/* 3. Refund Dispute Workflow */}
              {isRefundCase(selectedDetailOrder) && (
                <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-300 text-amber-950 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-amber-900">
                      <RotateCcw className="w-4 h-4 text-amber-700" />
                      <span>Bank Refund Settlement Verification & UTR Details</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      selectedDetailOrder.refundDetails?.refundStatus === 'processed'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-amber-200 text-amber-950'
                    }`}>
                      {selectedDetailOrder.refundDetails?.refundStatus === 'processed' ? 'Refund Processed ✓' : 'Settlement In Queue'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-white p-3 rounded-xl border border-amber-200 text-xs">
                    <div>
                      <span className="text-[11px] text-neutral-500 font-medium block">Target Refund UPI:</span>
                      <span className="font-mono font-bold text-neutral-900">
                        {selectedDetailOrder.refundDetails?.refundUpiId || selectedDetailOrder.customer.phone}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-neutral-500 font-medium block">Bank UTR Reference:</span>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="font-mono font-bold text-emerald-800">
                          {selectedDetailOrder.refundDetails?.refundUtr || 'Pending UTR'}
                        </span>
                        {selectedDetailOrder.refundDetails?.refundUtr && (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(selectedDetailOrder.refundDetails!.refundUtr!, `utr-copy-${selectedDetailOrder.id}`)}
                            className="p-0.5 hover:text-emerald-900"
                            title="Copy UTR"
                          >
                            {copiedKey === `utr-copy-${selectedDetailOrder.id}` ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="text-[11px] text-neutral-500 font-medium block">Refund Settlement Amount:</span>
                      <span className="font-serif font-bold text-neutral-900 text-sm">
                        {formatPrice(selectedDetailOrder.refundDetails?.refundAmount || selectedDetailOrder.totalAmount)}
                      </span>
                    </div>
                  </div>

                  {/* Verify / Update UTR button */}
                  <div className="pt-2 border-t border-amber-200 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setRefundVerificationOrder(selectedDetailOrder);
                        setRefundVerifyUtr(selectedDetailOrder.refundDetails?.refundUtr || '');
                        setRefundVerifyTool(selectedDetailOrder.refundDetails?.refundTool || 'UPI Banking');
                        setRefundVerifyNotes(selectedDetailOrder.refundDetails?.notes || '');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition shadow-2xs flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Verify / Update Bank Refund UTR</span>
                    </button>
                  </div>
                </div>
              )}

              {/* DEDICATED INVESTIGATION COLUMNS (Requirement: Dedicated columns for staff/admins to save investigation logs/notes) */}
              <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-amber-600" />
                    <h4 className="font-bold text-xs text-neutral-900 uppercase tracking-wider">
                      Dedicated Investigation Columns & Logs Thread ({selectedDetailOrder.deliveryIssue?.investigationComments?.length || 0})
                    </h4>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  {/* Left Column: Previous Investigation Logs */}
                  <div className="md:col-span-7 space-y-2">
                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                      Investigation History & Courier Updates:
                    </span>
                    {(!selectedDetailOrder.deliveryIssue?.investigationComments || selectedDetailOrder.deliveryIssue.investigationComments.length === 0) ? (
                      <p className="text-xs text-neutral-400 italic bg-white p-3 rounded-xl border border-neutral-200">
                        No investigation notes logged yet. Use the column on the right to log courier coordination notes.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {selectedDetailOrder.deliveryIssue.investigationComments.map((comm) => (
                          <div
                            key={comm.id}
                            className="p-2.5 rounded-xl bg-white border border-neutral-200 text-xs space-y-1 shadow-2xs"
                          >
                            <div className="flex items-center justify-between text-[11px] text-neutral-500">
                              <span className="font-bold text-neutral-900 flex items-center gap-1">
                                <UserCheck className="w-3 h-3 text-amber-600" />
                                <span>{comm.author}</span>
                              </span>
                              <span>{new Date(comm.timestamp).toLocaleString('en-IN')}</span>
                            </div>
                            <p className="text-neutral-800 leading-relaxed font-medium">{comm.comment}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right Column: New Investigation Log Entry Form */}
                  <div className="md:col-span-5 space-y-2">
                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                      Log New Finding / Update:
                    </span>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const note = investigationInputText[selectedDetailOrder.id]?.trim();
                        if (!note) return;
                        await addInvestigationComment(selectedDetailOrder.id, note, currentUserName, 'investigating');
                        setInvestigationInputText((prev) => ({ ...prev, [selectedDetailOrder.id]: '' }));
                        // Update local modal state
                        setSelectedDetailOrder({
                          ...selectedDetailOrder,
                          deliveryIssue: {
                            ...(selectedDetailOrder.deliveryIssue || {
                              reported: true,
                              reportedAt: new Date().toISOString(),
                              customerPhone: selectedDetailOrder.customer.phone,
                              issueDescription: 'Dispute log',
                              status: 'investigating',
                            }),
                            status: 'investigating',
                            investigationComments: [
                              ...(selectedDetailOrder.deliveryIssue?.investigationComments || []),
                              {
                                id: `comm-${Date.now()}`,
                                timestamp: new Date().toISOString(),
                                author: currentUserName,
                                comment: note,
                              },
                            ],
                          },
                        });
                      }}
                      className="space-y-2"
                    >
                      <textarea
                        rows={3}
                        value={investigationInputText[selectedDetailOrder.id] || ''}
                        onChange={(e) => setInvestigationInputText({ ...investigationInputText, [selectedDetailOrder.id]: e.target.value })}
                        placeholder="Type courier branch finding, handover check, or customer phone notes..."
                        className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white text-xs text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                      />
                      <button
                        type="submit"
                        disabled={!investigationInputText[selectedDetailOrder.id]?.trim()}
                        className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-neutral-950 font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Save Investigation Log Entry</span>
                      </button>
                    </form>
                  </div>
                </div>
              </div>

              {/* DISPUTE CLOSURE ACTION (Requirement: Formally resolve and close the dispute once investigation and processing are complete) */}
              {selectedDetailOrder.deliveryIssue?.reported && selectedDetailOrder.deliveryIssue.status !== 'resolved' && (
                <div className="p-4 rounded-2xl bg-neutral-900 text-white space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                      <div>
                        <h4 className="font-serif font-bold text-sm text-white">Dispute Closure & Settlement</h4>
                        <p className="text-[11px] text-neutral-400">
                          Formally resolve this dispute once courier investigation or refund processing is finished
                        </p>
                      </div>
                    </div>
                  </div>

                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!disputeResolutionNote.trim()) return;
                      await resolveDeliveryIssue(selectedDetailOrder.id, disputeResolutionNote.trim(), 'resolve');
                      setDisputeResolutionNote('');
                      setSelectedDetailOrder({
                        ...selectedDetailOrder,
                        disputeResolvedAt: new Date().toISOString(),
                        disputeResolvedBy: currentUserName,
                        deliveryIssue: {
                          ...(selectedDetailOrder.deliveryIssue || {
                            reported: true,
                            reportedAt: new Date().toISOString(),
                            customerPhone: selectedDetailOrder.customer.phone,
                            issueDescription: 'Dispute',
                            status: 'resolved',
                          }),
                          status: 'resolved',
                          resolutionNotes: disputeResolutionNote.trim(),
                          resolvedAt: new Date().toISOString(),
                          resolvedBy: currentUserName,
                        },
                      });
                    }}
                    className="space-y-2 pt-1 border-t border-neutral-800"
                  >
                    <label className="block text-xs font-semibold text-emerald-300">
                      Official Resolution Summary & Findings *
                    </label>
                    <input
                      type="text"
                      required
                      value={disputeResolutionNote}
                      onChange={(e) => setDisputeResolutionNote(e.target.value)}
                      placeholder="e.g. Courier hub re-attempted delivery; package verified handed over to customer."
                      className="w-full p-2.5 rounded-xl bg-neutral-800 border border-neutral-700 text-white text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>Formally Resolve & Close Dispute</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Standard Details: Customer Profile & Delivery Address */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block">
                    Customer Profile & Contact
                  </span>
                  <p className="font-bold text-neutral-900 text-sm">{selectedDetailOrder.customer.name}</p>
                  <p className="font-mono text-neutral-700">{selectedDetailOrder.customer.phone}</p>
                  {selectedDetailOrder.customer.email && (
                    <p className="text-neutral-500 truncate">{selectedDetailOrder.customer.email}</p>
                  )}
                </div>

                <div className="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block">
                    Delivery Shipping Address
                  </span>
                  <p className="text-neutral-800 leading-relaxed font-medium">
                    {selectedDetailOrder.customer.address}, {selectedDetailOrder.customer.city},{' '}
                    {selectedDetailOrder.customer.state} - {selectedDetailOrder.customer.pincode}
                  </p>
                </div>
              </div>

              {/* Items Ordered with SKU Code */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block">
                  Items Ordered ({selectedDetailOrder.items.length})
                </span>
                <div className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200 overflow-hidden bg-white">
                  {selectedDetailOrder.items.map((item, idx) => (
                    <div key={idx} className="p-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={item.product.images[0] || '/assets/images/hero_saree_atelier_1791651761357.jpg'}
                          alt={item.product.title}
                          className="w-12 h-12 rounded-xl object-cover border border-neutral-200 shrink-0"
                        />
                        <div>
                          <p className="font-bold text-neutral-900">{item.product.title}</p>
                          <p className="text-[11px] text-neutral-500 font-mono">
                            SKU: {item.product.productCode || item.product.id} · Qty: {item.quantity} · {item.product.fabric || 'Pure Silk'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-serif font-bold text-sm text-neutral-900">
                          {formatPrice(item.product.price * item.quantity)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financials & Payment UTR */}
              <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-neutral-600">Subtotal:</span>
                  <span className="font-semibold text-neutral-900">{formatPrice(selectedDetailOrder.subtotal)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-neutral-600">Shipping:</span>
                  <span className="font-semibold text-neutral-900">
                    {selectedDetailOrder.shippingFee === 0 ? 'FREE' : formatPrice(selectedDetailOrder.shippingFee)}
                  </span>
                </div>
                <div className="pt-2 border-t border-amber-200 flex justify-between items-center text-sm">
                  <span className="font-bold text-neutral-900">Total Paid:</span>
                  <span className="font-serif font-bold text-base text-neutral-950">
                    {formatPrice(selectedDetailOrder.totalAmount)}
                  </span>
                </div>
                <div className="pt-2 border-t border-amber-200 flex items-center justify-between text-xs">
                  <span className="text-neutral-600">Prepaid Payment UTR:</span>
                  <code className="font-mono font-bold text-neutral-900 bg-white px-2 py-0.5 rounded border border-amber-200">
                    {selectedDetailOrder.upiTransactionId}
                  </code>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between gap-2 shrink-0 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  const text = `Order #${selectedDetailOrder.orderNumber} - ${selectedDetailOrder.customer.name} (${selectedDetailOrder.customer.phone}) - Amount: ${formatPrice(selectedDetailOrder.totalAmount)} - Status: ${selectedDetailOrder.status}`;
                  navigator.clipboard.writeText(text);
                }}
                className="px-3 py-2 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-700 font-semibold text-xs flex items-center gap-1.5 transition"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Summary</span>
              </button>

              <div className="flex items-center gap-2 flex-wrap">
                {selectedDetailOrder.status === 'Delivered' && (
                  selectedDetailOrder.isClosed ? (
                    <div className="flex items-center gap-1.5">
                      <span className="px-3 py-2 rounded-xl bg-emerald-950 text-emerald-300 font-bold text-xs flex items-center gap-1 border border-emerald-800">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Closed & Realized in Analytics</span>
                      </span>
                      {canEditOrders && (
                        <button
                          type="button"
                          onClick={() => {
                            const reason = prompt('Reason for reopening this delivered order:');
                            if (reason && reason.trim()) {
                              reopenOrder(selectedDetailOrder.id, currentUserName, reason.trim());
                              setSelectedDetailOrder({ ...selectedDetailOrder, isClosed: false });
                            }
                          }}
                          className="px-2.5 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-xs border border-amber-300 transition cursor-pointer"
                          title="Reopen order (immediately deducts units and revenue from sales analytics in real time)"
                        >
                          Reopen
                        </button>
                      )}
                    </div>
                  ) : (
                    canEditOrders && (
                      <button
                        type="button"
                        onClick={() => {
                          closeOrder(selectedDetailOrder.id, currentUserName);
                          setSelectedDetailOrder({ ...selectedDetailOrder, isClosed: true });
                        }}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                        title="Formally close order (commits units sold & revenue to sales analytics)"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Close Order (Delivered & Verified)</span>
                      </button>
                    )
                  )
                )}
                <button
                  type="button"
                  onClick={() => {
                    setLiveChatOrder(selectedDetailOrder);
                    setSelectedDetailOrder(null);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                  title="Open live chat with customer"
                >
                  <MessageSquare className="w-3.5 h-3.5 fill-white" />
                  <span>Live Chat {selectedDetailOrder.chatMessages?.length ? `(${selectedDetailOrder.chatMessages.length})` : ''}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const cleanPhone = selectedDetailOrder.customer.phone.replace(/[^0-9]/g, '');
                    const msg = `Namaste ${selectedDetailOrder.customer.name}! 🪔✨\n\nRegarding your order #${selectedDetailOrder.orderNumber} at *${settings.boutiqueName}*.\nCurrent Status: *${selectedDetailOrder.status}*.\n\nPlease let us know if you have any questions!`;
                    openWhatsApp(cleanPhone, msg);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>WhatsApp Customer</span>
                </button>
                {canEditOrders && (
                  <button
                    type="button"
                    onClick={() => {
                      setDeletingOrder(selectedDetailOrder);
                      setDeleteRestockItems(
                        selectedDetailOrder.status !== 'Cancelled' &&
                          selectedDetailOrder.status !== 'Delivered' &&
                          !selectedDetailOrder.isRestocked
                      );
                      setDeleteReasonNote(
                        selectedDetailOrder.status === 'Delivered' || selectedDetailOrder.isClosed
                          ? 'Clean up completed / closed order'
                          : ''
                      );
                    }}
                    className="px-3.5 py-2 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                    title="Remove this order record from active view and database"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-700" />
                    <span>Delete Order</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedDetailOrder(null)}
                  className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Cancellation Approval & Refund Modal (Auto-Restock) */}
      {cancellationApproveOrder && (
        <div className="fixed inset-0 z-70 overflow-y-auto bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-200 my-auto">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-emerald-950 via-neutral-900 to-emerald-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <RotateCcw className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-serif text-base font-bold text-white">
                    Approve Cancellation & Issue Refund
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
              {/* Order & Cancellation Details Card */}
              <div className="p-3.5 bg-emerald-50/70 rounded-2xl border border-emerald-200 text-emerald-950 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-neutral-600">Refund Settlement Amount:</span>
                  <span className="font-serif font-bold text-base text-rose-900">
                    {formatPrice(cancellationApproveOrder.totalAmount)}
                  </span>
                </div>
                <div className="text-[11px] text-neutral-600 pt-1 border-t border-emerald-200/80">
                  <p>
                    <strong>Customer Stated Reason:</strong> "{cancellationApproveOrder.cancellationRequest?.reason || 'Customer requested cancellation'}"
                  </p>
                  <p className="mt-0.5">
                    <strong>Customer Mobile:</strong> {cancellationApproveOrder.customer.phone}
                  </p>
                </div>
              </div>

              {/* Auto-Restock Indicator */}
              <div className="p-3 bg-blue-50 rounded-2xl border border-blue-200 text-blue-950 flex flex-col gap-2">
                <div className="flex items-start gap-2.5">
                  <Package className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div className="text-[11px] space-y-0.5">
                    <p className="font-bold text-blue-900">Auto-Restock to Inventory Active</p>
                    <p className="text-blue-800 leading-relaxed">
                      Confirming this will restore strictly the exact quantity purchased back into the active boutique physical inventory.
                    </p>
                  </div>
                </div>

                {/* Exact Restocked Items Breakdown */}
                {cancellationApproveOrder.items && cancellationApproveOrder.items.length > 0 && (
                  <div className="pt-2 border-t border-blue-200/70 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-blue-900">
                      Exact Items & Physical Quantities to Restore:
                    </p>
                    <div className="space-y-1">
                      {cancellationApproveOrder.items.map((it, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-white/80 px-2.5 py-1.5 rounded-lg text-[11px] border border-blue-200">
                          <span className="font-medium text-neutral-800 truncate max-w-[260px]">
                            {it.product.title}
                          </span>
                          <span className="font-bold text-emerald-700 shrink-0">
                            +{it.quantity} {it.quantity > 1 ? 'items' : 'item'} to physical stock
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Refund Target UPI ID */}
              <div>
                <label className="block font-bold text-neutral-800 mb-1">
                  Customer Refund Target UPI ID / Mobile *
                </label>
                <input
                  type="text"
                  required
                  value={cancellationApproveUpiTarget}
                  onChange={(e) => setCancellationApproveUpiTarget(e.target.value)}
                  placeholder="e.g. customer@okhdfcbank or 9876543210"
                  className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white text-neutral-900 font-mono text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              {/* Payment Tool & UTR Number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-neutral-800 mb-1">
                    Refund Payout Mode *
                  </label>
                  <select
                    value={cancellationApproveTool}
                    onChange={(e) => setCancellationApproveTool(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white text-neutral-900 text-xs font-medium"
                  >
                    <option value="UPI Banking">UPI Banking</option>
                    <option value="PhonePe">PhonePe</option>
                    <option value="Google Pay">Google Pay</option>
                    <option value="Paytm">Paytm</option>
                    <option value="IMPS / NEFT">IMPS / NEFT</option>
                  </select>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-bold text-neutral-800">
                      Bank Refund UTR *
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setCancellationApproveUtr(
                          `UTR${Math.floor(100000000000 + Math.random() * 900000000000)}`
                        )
                      }
                      className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold underline cursor-pointer"
                    >
                      Generate UTR
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={cancellationApproveUtr}
                    onChange={(e) => setCancellationApproveUtr(e.target.value)}
                    placeholder="12-digit Bank UTR / Ref"
                    className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white text-neutral-900 font-mono text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Admin Decision Notes */}
              <div>
                <label className="block font-bold text-neutral-800 mb-1">
                  Concierge Audit / Resolution Notes
                </label>
                <textarea
                  rows={2}
                  value={cancellationApproveNotes}
                  onChange={(e) => setCancellationApproveNotes(e.target.value)}
                  placeholder="e.g. Cancellation approved per patron request. Saree restored to inventory."
                  className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white text-neutral-900 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden resize-none"
                />
              </div>

              {/* Action Buttons */}
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
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Confirm Approval & Settle Refund</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Cancellation Decline Modal */}
      {cancellationDeclineOrder && (
        <div className="fixed inset-0 z-70 overflow-y-auto bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-200 my-auto">
            {/* Modal Header */}
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

              {/* Quick reason presets */}
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

              {/* Reason Input */}
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

              {/* Action Buttons */}
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

      {/* MODAL: Dedicated Order Deletion / Removal Modal for Staff & Admins */}
      {deletingOrder && (
        <div className="fixed inset-0 z-70 overflow-y-auto bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-200 my-auto">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-rose-950 via-neutral-900 to-rose-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  <Trash2 className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <h3 className="font-serif text-base font-bold text-white">
                    Remove / Delete Order Record
                  </h3>
                  <p className="text-[11px] text-rose-300">
                    Order #{deletingOrder.orderNumber} · {deletingOrder.customer.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingOrder(null)}
                className="p-1 rounded-full text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-neutral-700">
              {/* Order Summary Snapshot */}
              <div className="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs text-neutral-900 bg-white px-2 py-0.5 rounded border border-neutral-200">
                    #{deletingOrder.orderNumber}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      deletingOrder.status === 'Cancelled' || deletingOrder.status === 'Rejected'
                        ? 'bg-rose-100 text-rose-800'
                        : deletingOrder.status === 'Delivered'
                        ? 'bg-emerald-100 text-emerald-800'
                        : deletingOrder.status === 'Shipped'
                        ? 'bg-blue-100 text-blue-800'
                        : deletingOrder.status === 'Confirmed'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    Stage: {deletingOrder.status} {deletingOrder.isClosed ? '(Closed)' : ''}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-neutral-200/80 text-[11px]">
                  <div>
                    <span className="text-neutral-500">Customer:</span>
                    <p className="font-bold text-neutral-800 truncate">{deletingOrder.customer.name}</p>
                    <p className="font-mono text-neutral-600">{deletingOrder.customer.phone}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-neutral-500">Total Value:</span>
                    <p className="font-serif font-bold text-sm text-neutral-900">
                      {formatPrice(deletingOrder.totalAmount)}
                    </p>
                    <p className="text-neutral-600">{deletingOrder.items.length} {deletingOrder.items.length === 1 ? 'saree item' : 'saree items'}</p>
                  </div>
                </div>
              </div>

              {/* Warning Notice */}
              <div className="p-3 bg-rose-50 rounded-2xl border border-rose-200 text-rose-950 space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-rose-900">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Permanent Order Record Removal</span>
                </p>
                <p className="text-[11px] text-rose-900 leading-relaxed">
                  Removing this order will completely clean up the record from the active order queue, all staff handling buckets, and the persistent database.
                </p>
              </div>

              {/* Optional Auto-Restock Sarees Option */}
              {deletingOrder.items && deletingOrder.items.length > 0 && !deletingOrder.isRestocked && deletingOrder.status !== 'Cancelled' && (
                <div className="p-3 bg-amber-50/70 rounded-2xl border border-amber-200 text-amber-950 space-y-2">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={deleteRestockItems}
                      onChange={(e) => setDeleteRestockItems(e.target.checked)}
                      className="mt-0.5 rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                    />
                    <div>
                      <span className="font-bold text-amber-900 text-xs block">
                        Restock items back into boutique inventory
                      </span>
                      <span className="text-[11px] text-amber-800 leading-relaxed block mt-0.5">
                        Automatically return the {deletingOrder.items.reduce((acc, it) => acc + it.quantity, 0)} saree pieces from this order back to available stock.
                      </span>
                    </div>
                  </label>

                  {deleteRestockItems && (
                    <div className="pt-2 border-t border-amber-200/80 space-y-1">
                      {deletingOrder.items.map((it, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-white/90 px-2.5 py-1 rounded-lg text-[10px] border border-amber-200">
                          <span className="font-medium text-neutral-800 truncate max-w-[240px]">
                            {it.product.title}
                          </span>
                          <span className="font-bold text-emerald-700">
                            +{it.quantity} to stock
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Quick Reason Presets */}
              <div>
                <label className="block font-bold text-neutral-800 mb-1.5">
                  Reason for Removal (Optional Audit Log):
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {[
                    'Clean up completed / closed order',
                    'Test / duplicate order record',
                    'Customer cancelled & requested removal',
                    'Unwanted / abandoned record',
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setDeleteReasonNote(preset)}
                      className={`text-[10px] px-2 py-1 rounded-lg border text-left transition cursor-pointer ${
                        deleteReasonNote === preset
                          ? 'bg-rose-100 text-rose-900 border-rose-300 font-bold'
                          : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-700 border-neutral-200'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={deleteReasonNote}
                  onChange={(e) => setDeleteReasonNote(e.target.value)}
                  placeholder="Enter reason or note for deleting this order..."
                  className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white text-neutral-900 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setDeletingOrder(null)}
                  className="px-4 py-2.5 rounded-xl border border-neutral-300 text-neutral-700 font-semibold hover:bg-neutral-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleConfirmDeleteOrder}
                  className="px-5 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-600 disabled:opacity-50 text-white font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{isDeleting ? 'Deleting...' : 'Delete Order Record'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
