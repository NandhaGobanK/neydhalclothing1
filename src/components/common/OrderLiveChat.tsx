import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { Order, OrderChatMessage } from '../../types/store';
import {
  getNotificationPermission,
  requestNotificationPermission,
  triggerDeviceVibration,
} from '../../utils/deviceNotifications';
import { playChatChimeSound } from '../../utils/audio';
import {
  getOrderContextualTemplates,
  OrderChatTemplate,
  openWhatsApp,
} from '../../utils/upi';
import {
  MessageSquare,
  Send,
  Loader2,
  CheckCheck,
  Shield,
  User,
  Sparkles,
  Clock,
  HelpCircle,
  Headphones,
  Check,
  Lock,
  Bell,
  Volume2,
  Layers,
  ExternalLink,
  FileText,
  X,
  Truck,
  RotateCcw,
  Ban,
  CheckCircle2,
  ChevronRight,
  Copy,
} from 'lucide-react';

interface OrderLiveChatProps {
  order: Order;
  mode: 'customer' | 'admin';
  title?: string;
  className?: string;
}

export const OrderLiveChat: React.FC<OrderLiveChatProps> = ({
  order,
  mode,
  title,
  className = '',
}) => {
  const { sendOrderChatMessage, markOrderChatMessagesAsRead, currentUser, settings } = useStore();
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendFeedback, setSendFeedback] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Template Modal & Drawer State
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<
    'all' | 'cancellation_dispute' | 'delivery_dispute' | 'refund_dispute' | 'order_milestone'
  >('all');
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);

  // Retrieve dynamically prefilled templates matching this exact order state
  const { templates: availableTemplates, topSuggestedTemplate } = useMemo(() => {
    return getOrderContextualTemplates(order, settings);
  }, [order, settings]);

  const [notificationPermission, setNotificationPermission] = useState<string>(() => {
    return getNotificationPermission();
  });
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [permissionNotice, setPermissionNotice] = useState<string | null>(null);

  const messages: OrderChatMessage[] = order.chatMessages || [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  // Automatically mark unread messages as read when viewing chat
  useEffect(() => {
    if (order.id) {
      markOrderChatMessagesAsRead(order.id, mode === 'customer' ? 'customer' : 'staff');
    }
  }, [order.id, mode, messages.length]);

  const handleEnableNotifications = async () => {
    setIsRequestingPermission(true);
    const granted = await requestNotificationPermission();
    setNotificationPermission(getNotificationPermission());
    setIsRequestingPermission(false);

    if (granted) {
      playChatChimeSound(mode === 'customer');
      triggerDeviceVibration([150, 75, 150]);
      setPermissionNotice('Device notifications active!');
      setTimeout(() => setPermissionNotice(null), 3000);
    } else {
      setPermissionNotice('Notifications blocked in browser settings.');
      setTimeout(() => setPermissionNotice(null), 3500);
    }
  };

  const handleTestSound = () => {
    playChatChimeSound(mode === 'customer');
    triggerDeviceVibration(mode === 'customer' ? [180, 80, 180] : [220, 100, 220]);
    setPermissionNotice('Notification sound & vibration tested!');
    setTimeout(() => setPermissionNotice(null), 2500);
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Dynamic context-aware chips for customers based on whether a dispute is active
  const isDeliveryIssueActive = Boolean(
    order.deliveryIssue?.reported &&
      (order.deliveryIssue.issueType === 'delivery' || (!order.deliveryIssue.issueType && order.status === 'Delivered')) &&
      order.deliveryIssue.status !== 'resolved'
  );
  const isRefundIssueActive = Boolean(
    (order.deliveryIssue?.reported && order.deliveryIssue.issueType === 'refund') ||
      order.status === 'Refunded'
  );
  const isCancelRequestActive = Boolean(
    order.cancellationRequest?.requested && order.cancellationRequest.status === 'pending'
  );

  const customerQuickChips = useMemo(() => {
    if (isDeliveryIssueActive) {
      return [
        'Any update from the courier delivery hub?',
        'Please verify my delivery doorstep address',
        'I have not received any courier delivery call',
        'Please escalate with courier hub manager',
      ];
    }
    if (isRefundIssueActive) {
      return [
        'Please share the 12-digit refund UTR number',
        'Which UPI ID was my refund transferred to?',
        'When will the refund reflect in my bank?',
        'Please verify refund transaction settlement',
      ];
    }
    if (isCancelRequestActive) {
      return [
        'What is the review status of my cancellation?',
        'Please confirm approval and refund timeline',
        'Please ensure item is auto-restocked',
      ];
    }
    return [
      'When will my saree be delivered?',
      'Please confirm courier tracking number',
      'Is safe tamper-proof gift box included?',
      'I have special delivery instructions',
    ];
  }, [isDeliveryIssueActive, isRefundIssueActive, isCancelRequestActive]);

  const staffQuickChips = [
    'Your saree has been inspected and is packed for dispatch.',
    'Tracking consignment ID has been verified with the courier.',
    'We are coordinating with the local delivery hub.',
    'Your inquiry is noted and prioritized by our concierge.',
  ];

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isSending) return;

    setIsSending(true);
    setSendFeedback(null);

    const senderType = mode === 'customer' ? 'customer' : currentUser?.type === 'admin' ? 'admin' : 'staff';
    const senderName =
      mode === 'customer'
        ? order.customer.name || 'Customer'
        : currentUser?.name || (currentUser?.type === 'admin' ? 'Store Owner' : 'Atelier Concierge');

    try {
      const res = await sendOrderChatMessage(order.id, text, senderType, senderName);
      if (res.success) {
        if (!textToSend) setInputText('');
        setSendFeedback('Sent');
        setTimeout(() => setSendFeedback(null), 2000);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Live Chat Availability rules:
  // Customers and staff can communicate in real time directly on each order.
  // In accordance with store rules: once a dispute is resolved, or if the order is closed,
  // the order-specific live chat facility automatically becomes unavailable and disabled for the customer.
  const isDisputeResolved = Boolean(
    order.deliveryIssue?.reported && order.deliveryIssue.status === 'resolved'
  );
  const isOrderClosed = Boolean(order.isClosed);
  const isCustomerChatDisabled = mode === 'customer' && (isOrderClosed || isDisputeResolved);
  const hasActiveDispute = Boolean(
    (order.deliveryIssue?.reported && order.deliveryIssue?.status !== 'resolved') ||
    (order.cancellationRequest?.requested && order.cancellationRequest?.status === 'pending')
  );

  const chatDisabledReason = isDisputeResolved
    ? 'This dispute has been officially resolved and closed by boutique concierge. In accordance with store rules, live chat is now disabled for this order.'
    : isOrderClosed
    ? 'This order has been officially closed by the boutique atelier. Live chat is now closed, but previous conversation history is preserved.'
    : 'Live chat is currently unavailable.';

  return (
    <div
      className={`rounded-2xl border ${
        mode === 'customer'
          ? 'border-amber-200/90 bg-gradient-to-b from-amber-50/40 via-white to-white'
          : 'border-neutral-200 bg-white'
      } shadow-xs flex flex-col overflow-hidden text-xs ${className}`}
    >
      {/* Chat Header */}
      <div
        className={`px-4 py-3 flex items-center justify-between border-b ${
          mode === 'customer'
            ? 'bg-gradient-to-r from-neutral-900 via-neutral-950 to-neutral-900 text-white'
            : 'bg-neutral-50 text-neutral-900 border-neutral-200'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              mode === 'customer'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'bg-blue-600/10 text-blue-700 border border-blue-200'
            }`}
          >
            {mode === 'customer' ? (
              <Headphones className="w-4 h-4 text-amber-300" />
            ) : (
              <MessageSquare className="w-4 h-4 text-blue-700" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-serif font-bold text-sm truncate">
                {title || (mode === 'customer' ? 'Atelier Concierge Live Chat' : `Chat with ${order.customer.name}`)}
              </h4>
              {isCustomerChatDisabled ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-neutral-800 text-neutral-300 border border-neutral-700">
                  <span>Chat Closed</span>
                </span>
              ) : hasActiveDispute ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                  <span>Dispute Active · Priority</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Live</span>
                </span>
              )}
            </div>
            <p
              className={`text-[10px] truncate ${
                mode === 'customer' ? 'text-neutral-400' : 'text-neutral-500'
              }`}
            >
              Order #{order.orderNumber} · {order.customer.name} ({order.customer.phone})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Notification Alert Controls */}
          {notificationPermission === 'granted' ? (
            <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-2 py-1 text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className={`font-semibold hidden sm:inline ${mode === 'customer' ? 'text-emerald-300' : 'text-emerald-700'}`}>
                Device Alerts On
              </span>
              <button
                type="button"
                onClick={handleTestSound}
                className="ml-1 p-0.5 rounded text-neutral-400 hover:text-white transition cursor-pointer"
                title="Test notification chime sound & haptic vibration"
              >
                <Volume2 className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleEnableNotifications}
              disabled={isRequestingPermission}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 border transition cursor-pointer ${
                mode === 'customer'
                  ? 'bg-amber-500/20 text-amber-200 border-amber-500/40 hover:bg-amber-500/30'
                  : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
              }`}
              title="Click to turn on device alerts when new messages arrive"
            >
              <Bell className="w-3 h-3 animate-bounce shrink-0" />
              <span className="hidden sm:inline">Turn on Alerts</span>
            </button>
          )}

          <span className="text-[10px] font-mono text-neutral-400">
            {messages.length} {messages.length === 1 ? 'msg' : 'msgs'}
          </span>
        </div>
      </div>

      {/* Permission Feedback Toast */}
      {permissionNotice && (
        <div className="bg-amber-500 text-neutral-950 px-3 py-1 text-center font-bold text-[10px] transition animate-in fade-in">
          {permissionNotice}
        </div>
      )}

      {/* Notice Banner if Notifications are not yet enabled */}
      {notificationPermission === 'default' && !permissionNotice && (
        <div className={`px-3.5 py-1.5 border-b flex items-center justify-between gap-2 text-[10px] ${
          mode === 'customer'
            ? 'bg-amber-950/40 border-amber-500/20 text-amber-200'
            : 'bg-blue-50/70 border-blue-200 text-blue-900'
        }`}>
          <div className="flex items-center gap-1.5 min-w-0">
            <Bell className="w-3 h-3 text-amber-400 shrink-0" />
            <span className="truncate">
              {mode === 'customer'
                ? 'Enable device alerts so you never miss concierge delivery updates'
                : 'Enable device alerts for instant pings when customer replies'}
            </span>
          </div>
          <button
            type="button"
            onClick={handleEnableNotifications}
            disabled={isRequestingPermission}
            className="px-2 py-0.5 rounded-md bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-[10px] shrink-0 transition shadow-2xs cursor-pointer"
          >
            {isRequestingPermission ? 'Enabling...' : 'Enable'}
          </button>
        </div>
      )}

      {/* Messages Stream Container */}
      <div className="p-3.5 sm:p-4 space-y-3 max-h-72 min-h-48 overflow-y-auto bg-neutral-50/50">
        {messages.length === 0 ? (
          <div className="py-8 text-center text-neutral-400 space-y-2">
            <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center mx-auto border border-amber-200">
              <Sparkles className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="font-bold text-neutral-800 text-xs">
                {mode === 'customer'
                  ? 'Namaste! Connect directly with our atelier team'
                  : 'No messages yet for this order'}
              </p>
              <p className="text-[11px] text-neutral-500 max-w-sm mx-auto mt-0.5">
                {mode === 'customer'
                  ? 'Send a question regarding your order delivery, custom blouse stitching, or packaging. Our boutique concierge replies right here.'
                  : `Customer ${order.customer.name} has not sent inquiries yet. You can proactively message them here.`}
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe =
              (mode === 'customer' && msg.sender === 'customer') ||
              (mode === 'admin' && (msg.sender === 'staff' || msg.sender === 'admin'));

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-in fade-in duration-150`}
              >
                <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] text-neutral-400 font-medium">
                  {msg.sender === 'customer' ? (
                    <span className="flex items-center gap-1 text-neutral-600 font-bold">
                      <User className="w-3 h-3 text-neutral-500" />
                      <span>{msg.senderName} (Customer)</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-800 font-bold bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                      <Shield className="w-3 h-3 text-amber-600" />
                      <span>{settings.boutiqueName} Concierge · {msg.senderName}</span>
                    </span>
                  )}
                  <span>·</span>
                  <span className="font-mono">
                    {new Date(msg.timestamp).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                <div
                  className={`p-3 rounded-2xl max-w-[85%] sm:max-w-[75%] leading-relaxed text-xs shadow-2xs break-words ${
                    isMe
                      ? mode === 'customer'
                        ? 'bg-rose-900 text-white rounded-tr-xs'
                        : 'bg-neutral-900 text-white rounded-tr-xs'
                      : 'bg-white border border-neutral-200 text-neutral-900 rounded-tl-xs'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.message}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* If customer chat is disabled (e.g. Delivered without active dispute, or resolved/closed), show notice */}
      {isCustomerChatDisabled ? (
        <div className="p-3.5 bg-neutral-100 border-t border-neutral-200 text-center text-xs text-neutral-600 flex items-center justify-center gap-2">
          <Lock className="w-4 h-4 text-neutral-500 shrink-0" />
          <span className="text-[11px] font-medium leading-relaxed">{chatDisabledReason}</span>
        </div>
      ) : (
        <>
          {/* Staff/Admin Contextual Stage Template Suggestion Banner */}
          {mode === 'admin' && topSuggestedTemplate && (
            <div className="px-3 py-2 bg-gradient-to-r from-amber-50 to-orange-50/80 border-t border-amber-200/90 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <Sparkles className="w-3.5 h-3.5 text-amber-700 shrink-0 animate-pulse" />
                <span className="text-[10px] uppercase font-bold text-amber-900 tracking-wider shrink-0 bg-amber-200/70 px-1.5 py-0.2 rounded">
                  {topSuggestedTemplate.badge || 'Stage Match'}
                </span>
                <span className="font-bold text-neutral-900 truncate text-[11px]" title={topSuggestedTemplate.title}>
                  {topSuggestedTemplate.title}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setInputText(topSuggestedTemplate.text)}
                  className="px-2 py-1 rounded-md bg-white hover:bg-amber-100 text-amber-950 font-bold text-[10px] border border-amber-300 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                  title="Prefill message input box with this template"
                >
                  <FileText className="w-3 h-3 text-amber-700" />
                  <span>Prefill</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSendMessage(topSuggestedTemplate.text)}
                  disabled={isSending}
                  className="px-2.5 py-1 rounded-md bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-[10px] transition cursor-pointer flex items-center gap-1 shadow-2xs"
                  title="Send this stage template directly in live chat"
                >
                  <Send className="w-2.5 h-2.5 text-amber-400" />
                  <span>Send</span>
                </button>

                <button
                  type="button"
                  onClick={() => openWhatsApp(order.customer.phone, topSuggestedTemplate.text)}
                  className="px-2 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] transition cursor-pointer flex items-center gap-1 shadow-2xs"
                  title="Open customer WhatsApp with this template prefilled"
                >
                  <span>WhatsApp</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
          )}

          {/* Suggested Quick Prompt Chips & Templates Button */}
          <div className="px-3 py-1.5 bg-neutral-100/70 border-t border-neutral-200 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {mode === 'admin' ? (
              <button
                type="button"
                onClick={() => setIsTemplateModalOpen(true)}
                className="px-2.5 py-1 rounded-full bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold text-[10px] flex items-center gap-1 shrink-0 transition cursor-pointer shadow-2xs"
                title="Browse and insert automated dispute, milestone, and WhatsApp templates"
              >
                <Layers className="w-3 h-3 text-neutral-950" />
                <span>Templates ({availableTemplates.length})</span>
              </button>
            ) : null}

            <span className="text-[10px] text-neutral-400 shrink-0 font-medium flex items-center gap-1">
              <HelpCircle className="w-3 h-3" />
              <span>Quick:</span>
            </span>

            {(mode === 'customer' ? customerQuickChips : staffQuickChips).map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(chip)}
                disabled={isSending}
                className="px-2.5 py-1 rounded-full bg-white hover:bg-neutral-200/80 text-neutral-700 text-[10px] font-medium border border-neutral-200/90 shrink-0 transition whitespace-nowrap cursor-pointer shadow-2xs"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Message Input Box */}
          <div className="p-3 bg-white border-t border-neutral-200">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  mode === 'customer'
                    ? 'Type your query or instruction for our concierge...'
                    : `Type reply to ${order.customer.name}...`
                }
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-neutral-300 bg-white text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40"
                disabled={isSending}
              />
              <button
                type="submit"
                disabled={!inputText.trim() || isSending}
                className={`px-4 py-2.5 rounded-xl text-white font-bold text-xs transition flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  mode === 'customer'
                    ? 'bg-rose-900 hover:bg-rose-800'
                    : 'bg-neutral-900 hover:bg-neutral-800'
                }`}
              >
                {isSending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : sendFeedback ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">Send</span>
              </button>
            </form>
          </div>

          {/* Master Automated Templates Browser Modal for Staff/Admin */}
          {isTemplateModalOpen && (
            <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in">
              <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 flex flex-col max-h-[88vh]">
                {/* Modal Header */}
                <div className="p-4 sm:p-5 bg-neutral-900 text-white flex items-center justify-between border-b border-neutral-800 shrink-0">
                  <div className="flex items-center gap-2.5">
                    <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                      <Layers className="w-5 h-5" />
                    </span>
                    <div>
                      <h3 className="font-serif font-bold text-base leading-tight">
                        Order #{order.orderNumber} Concierge Templates
                      </h3>
                      <p className="text-[11px] text-neutral-400">
                        Dispute stages, auto-restock, UTR verification, and milestone messages prefilled with order data.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsTemplateModalOpen(false)}
                    className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Sub-Tabs: Categories */}
                <div className="flex border-b border-neutral-200 bg-neutral-50 px-3 pt-2 overflow-x-auto no-scrollbar gap-1 shrink-0">
                  <button
                    onClick={() => setSelectedCategoryTab('all')}
                    className={`px-3 py-2 text-xs font-bold border-b-2 transition cursor-pointer whitespace-nowrap ${
                      selectedCategoryTab === 'all'
                        ? 'border-neutral-900 text-neutral-900'
                        : 'border-transparent text-neutral-500 hover:text-neutral-800'
                    }`}
                  >
                    All Templates ({availableTemplates.length})
                  </button>
                  <button
                    onClick={() => setSelectedCategoryTab('cancellation_dispute')}
                    className={`px-3 py-2 text-xs font-bold border-b-2 transition cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                      selectedCategoryTab === 'cancellation_dispute'
                        ? 'border-rose-800 text-rose-900'
                        : 'border-transparent text-neutral-500 hover:text-neutral-800'
                    }`}
                  >
                    <Ban className="w-3.5 h-3.5 text-rose-600" />
                    <span>Cancellation Dispute (3)</span>
                  </button>
                  <button
                    onClick={() => setSelectedCategoryTab('delivery_dispute')}
                    className={`px-3 py-2 text-xs font-bold border-b-2 transition cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                      selectedCategoryTab === 'delivery_dispute'
                        ? 'border-blue-800 text-blue-900'
                        : 'border-transparent text-neutral-500 hover:text-neutral-800'
                    }`}
                  >
                    <Truck className="w-3.5 h-3.5 text-blue-600" />
                    <span>Delivery Dispute (3)</span>
                  </button>
                  <button
                    onClick={() => setSelectedCategoryTab('refund_dispute')}
                    className={`px-3 py-2 text-xs font-bold border-b-2 transition cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                      selectedCategoryTab === 'refund_dispute'
                        ? 'border-emerald-800 text-emerald-900'
                        : 'border-transparent text-neutral-500 hover:text-neutral-800'
                    }`}
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Refund Dispute (3)</span>
                  </button>
                  <button
                    onClick={() => setSelectedCategoryTab('order_milestone')}
                    className={`px-3 py-2 text-xs font-bold border-b-2 transition cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                      selectedCategoryTab === 'order_milestone'
                        ? 'border-amber-800 text-amber-900'
                        : 'border-transparent text-neutral-500 hover:text-neutral-800'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    <span>Milestones (4)</span>
                  </button>
                </div>

                {/* Templates List */}
                <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3.5 text-xs bg-neutral-50/50">
                  {availableTemplates
                    .filter((tmpl) => selectedCategoryTab === 'all' || tmpl.category === selectedCategoryTab)
                    .map((tmpl) => {
                      const isExpanded = expandedTemplateId === tmpl.id;
                      return (
                        <div
                          key={tmpl.id}
                          className={`p-4 rounded-2xl border transition bg-white shadow-2xs space-y-2.5 ${
                            tmpl.isContextualMatch
                              ? 'border-amber-400 ring-2 ring-amber-300/40'
                              : 'border-neutral-200 hover:border-neutral-300'
                          }`}
                        >
                          {/* Template Header */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                                  tmpl.category === 'cancellation_dispute'
                                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                    : tmpl.category === 'delivery_dispute'
                                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                    : tmpl.category === 'refund_dispute'
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                                }`}
                              >
                                {tmpl.badge || tmpl.categoryLabel}
                              </span>
                              <h4 className="font-serif font-bold text-neutral-900 text-sm">
                                {tmpl.title}
                              </h4>
                            </div>

                            {tmpl.isContextualMatch && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500 text-neutral-950 font-bold text-[10px] self-start sm:self-auto shadow-2xs">
                                <Sparkles className="w-3 h-3" />
                                <span>Recommended for Current Stage</span>
                              </span>
                            )}
                          </div>

                          {/* Message Preview */}
                          <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200 text-neutral-800 font-mono text-[11px] leading-relaxed whitespace-pre-wrap max-h-36 overflow-y-auto">
                            {tmpl.text}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                            <button
                              type="button"
                              onClick={() => copyToClipboard(tmpl.text, tmpl.id)}
                              className="inline-flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-900 font-medium cursor-pointer"
                            >
                              {copiedKey === tmpl.id ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  <span className="text-emerald-700 font-bold">Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>Copy Text</span>
                                </>
                              )}
                            </button>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setInputText(tmpl.text);
                                  setIsTemplateModalOpen(false);
                                }}
                                className="px-3 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold text-xs transition cursor-pointer flex items-center gap-1 border border-neutral-300 shadow-2xs"
                              >
                                <FileText className="w-3.5 h-3.5 text-neutral-600" />
                                <span>Insert in Chat</span>
                              </button>

                              <button
                                type="button"
                                onClick={async () => {
                                  setIsTemplateModalOpen(false);
                                  await handleSendMessage(tmpl.text);
                                }}
                                className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1 shadow-xs"
                              >
                                <Send className="w-3.5 h-3.5 text-amber-400" />
                                <span>Send to Chat</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => openWhatsApp(order.customer.phone, tmpl.text)}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1 shadow-xs"
                              >
                                <span>WhatsApp</span>
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>

                {/* Modal Footer */}
                <div className="p-3 sm:p-4 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between text-xs text-neutral-500">
                  <span>Customer Phone: <strong>{order.customer.phone}</strong></span>
                  <button
                    type="button"
                    onClick={() => setIsTemplateModalOpen(false)}
                    className="px-4 py-1.5 rounded-xl bg-white border border-neutral-300 font-bold text-neutral-800 hover:bg-neutral-100 cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
