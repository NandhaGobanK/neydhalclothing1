import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useStore } from '../../context/StoreContext';
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
} from 'lucide-react';

export const OrderManager: React.FC = () => {
  const {
    orders,
    updateOrderStatus,
    updateOrderShipping,
    markRefundProcessed,
    assignOrderStaff,
    addOrderWorkLog,
    resolveCancellationRequest,
    staffMembers,
    settings,
    updateSettings,
    currentUser,
    currentPermissions,
  } = useStore();
  const isAdmin = currentUser?.type === 'admin';
  const canEditOrders = isAdmin || currentPermissions?.orders?.canEdit !== false;
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedStaffFilter, setSelectedStaffFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

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

  // Refund Modal State
  const [refundModalOrder, setRefundModalOrder] = useState<Order | null>(null);
  const [refundUtr, setRefundUtr] = useState('');
  const [refundNotes, setRefundNotes] = useState('');

  // Editable Automated Message Dispatcher Modal (User Request)
  const [messageModalOrder, setMessageModalOrder] = useState<Order | null>(null);
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

    // Open automated message editor so admin can review dynamic variables and personalize before sending
    handleOpenMessageModal(updatedOrder, targetStatus);
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

    // Open message modal populated with refund UTR details
    setMessageModalOrder(updatedOrder);
    setMessageModalStage(updatedOrder.status);
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

        <div className="flex items-center gap-2 flex-wrap">
          {/* Audio Notification Toggle and Test Button (User Request) */}
          <div className="inline-flex items-center gap-1 p-1 bg-neutral-100 rounded-xl border border-neutral-200">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
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
              onClick={() => playOrderNotificationSound()}
              className="p-1.5 rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200 text-xs font-medium transition"
              title="Test Order Chime"
            >
              <Bell className="w-3.5 h-3.5" />
            </button>
          </div>

          {settings.ordersSpreadsheetUrl && (
            <a
              href={settings.ordersSpreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-semibold shadow-xs transition"
              title="Open Google Sheet in new tab"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Open in Google Sheets</span>
              <ExternalLink className="w-3 h-3 text-emerald-600" />
            </a>
          )}

          <button
            onClick={() => setIsConfirmSyncOpen(true)}
            disabled={isSyncingSheets}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-xs transition disabled:opacity-50 cursor-pointer"
          >
            {isSyncingSheets ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-200" />
            )}
            <span>{isSyncingSheets ? 'Syncing...' : 'Sync with Google Sheets'}</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-xs font-semibold shadow-xs transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Incoming Order Real-Time Sound & Alert Banner (User Request) */}
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
              onClick={() => {
                setSearchQuery(newOrderAlert.orderNumber);
                setNewOrderAlert(null);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-bold transition shadow-xs"
            >
              View Order #{newOrderAlert.orderNumber}
            </button>
            <button
              onClick={() => setNewOrderAlert(null)}
              className="p-1.5 rounded-lg text-neutral-950 hover:bg-amber-400 transition"
              title="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Google Sheets Sync Alert Notifications */}
      {sheetSyncSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Successfully synchronized <strong>{sheetSyncSuccess.count} orders</strong> to your Google Sheets document!
            </span>
          </div>
          <a
            href={sheetSyncSuccess.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-bold text-emerald-700 underline hover:text-emerald-900"
          >
            <span>Open Sheet</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {sheetSyncError && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{sheetSyncError}</span>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            {(sheetSyncError.toLowerCase().includes('scope') ||
              sheetSyncError.toLowerCase().includes('authentication') ||
              sheetSyncError.toLowerCase().includes('permission')) && (
              <button
                onClick={handleAuthorizeAndSync}
                className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs transition"
              >
                Grant Google Permissions
              </button>
            )}
            <button
              onClick={() => setSheetSyncError(null)}
              className="text-rose-700 font-bold hover:underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

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
                          {/* Claim button for current user */}
                          {currentUser && order.assignedStaffId !== (currentUser.staffId || 'admin') && (
                            <button
                              type="button"
                              onClick={() => {
                                const myId = currentUser.staffId || 'admin';
                                const myName = currentUser.name || (isAdmin ? 'Store Owner' : 'Staff Concierge');
                                assignOrderStaff(order.id, myId, myName, 'Claimed by staff & started working on order');
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
                <label className="block font-bold text-neutral-800 mb-1">
                  Assignment / Handover Reason (Recorded in live log)
                </label>
                <input
                  type="text"
                  value={assignmentReason}
                  onChange={(e) => setAssignmentReason(e.target.value)}
                  placeholder="e.g. Assigned to Gugan due to emergency leave of Nandha"
                  className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white text-neutral-900"
                />
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
                    const selectedStaff = staffMembers.find((s) => s.id === targetStaffId);
                    const sName = targetStaffId === 'admin'
                      ? 'Store Owner'
                      : (selectedStaff?.name || 'Staff Specialist');
                    assignOrderStaff(assignModalOrder.id, targetStaffId, sName, assignmentReason);
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
    </div>
  );
};
