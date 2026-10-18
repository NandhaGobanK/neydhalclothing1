import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../../context/StoreContext';
import { Order, OrderChatMessage } from '../../types/store';
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
  const { sendOrderChatMessage, currentUser, settings } = useStore();
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendFeedback, setSendFeedback] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messages: OrderChatMessage[] = order.chatMessages || [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  const customerQuickChips = [
    'When will my saree be delivered?',
    'Please confirm courier tracking number',
    'Is safe gift packaging included?',
    'I have special delivery instructions',
  ];

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

  // Conditional Live Chat Availability rules based on Order & Dispute status
  const isDelivered = order.status === 'Delivered';
  const hasActiveDispute = Boolean(
    order.deliveryIssue &&
      (order.deliveryIssue.status === 'open' || order.deliveryIssue.status === 'investigating')
  );
  const isDisputeResolved = Boolean(
    order.deliveryIssue && order.deliveryIssue.status === 'resolved'
  );
  const isOrderClosed = Boolean(order.isClosed);

  // In customer mode, live chat is disabled if:
  // 1. Order is marked as Delivered and there is no active dispute
  // 2. Order is closed or dispute has been officially resolved
  // 3. Order is Cancelled or Rejected without an active dispute
  const isCustomerChatDisabled =
    mode === 'customer' &&
    (isOrderClosed ||
      isDisputeResolved ||
      (isDelivered && !hasActiveDispute) ||
      (order.status === 'Cancelled' && !hasActiveDispute) ||
      (order.status === 'Rejected' && !hasActiveDispute));

  const chatDisabledReason = isOrderClosed
    ? 'This order has been officially closed. Live chat is now unavailable.'
    : isDisputeResolved
    ? 'Your dispute/issue has been officially resolved and closed. Live chat is now unavailable.'
    : isDelivered && !hasActiveDispute
    ? 'Order successfully delivered. Live chat is disabled. (If you have any questions or issues, click "Report Issue" to open a dispute and activate concierge support).'
    : `Order is ${order.status.toLowerCase()}. Live chat is unavailable.`;

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

        <div className="text-right shrink-0">
          <span className="text-[10px] font-mono text-neutral-400">
            {messages.length} {messages.length === 1 ? 'msg' : 'msgs'}
          </span>
        </div>
      </div>

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
          {/* Suggested Quick Prompt Chips */}
          <div className="px-3 py-1.5 bg-neutral-100/70 border-t border-neutral-200 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
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
        </>
      )}
    </div>
  );
};
