import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { AppNotification } from '../../types/store';
import {
  X,
  Bell,
  BellRing,
  Sparkles,
  Package,
  MessageSquare,
  CheckCheck,
  Trash2,
  ChevronRight,
  Info,
} from 'lucide-react';
import { formatDeviceDateTime } from '../../utils/deviceTime';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenProduct?: (productId: string) => void;
  onOpenOrder?: (orderId: string) => void;
  onOpenChat?: (orderId: string) => void;
}

function timeAgo(dateOrIso?: string | number): string {
  if (!dateOrIso) return 'Just now';
  try {
    const diffMs = Date.now() - new Date(dateOrIso).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDeviceDateTime(dateOrIso, { shortDate: true });
  } catch {
    return 'Recently';
  }
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  onOpenProduct,
  onOpenOrder,
  onOpenChat,
}) => {
  const {
    customerNotifications,
    markCustomerNotificationRead,
    markAllCustomerNotificationsRead,
    clearCustomerNotifications,
    products,
    openProductPage,
    setSelectedCustomerOrderId,
    setCustomerActiveTab,
  } = useStore();

  const [activeTab, setActiveTab] = useState<'all' | 'order' | 'restock' | 'chat'>('all');

  if (!isOpen) return null;

  const unreadCount = (customerNotifications || []).filter((n) => !n.read && !n.isRead).length;

  const filteredNotifications = (customerNotifications || []).filter((n) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'order') return n.type === 'order';
    if (activeTab === 'restock') return n.type === 'restock';
    if (activeTab === 'chat') return n.type === 'chat';
    return true;
  });

  const handleNotificationClick = (notif: AppNotification) => {
    markCustomerNotificationRead(notif.id);

    if (notif.type === 'restock' && (notif.productId || notif.targetId)) {
      const pId = notif.productId || notif.targetId;
      const match = products.find((p) => p.id === pId);
      if (match) {
        openProductPage(match);
        onClose();
        return;
      }
      if (onOpenProduct && pId) {
        onOpenProduct(pId);
        onClose();
        return;
      }
    }

    if (notif.type === 'order') {
      const ordId = notif.orderId || notif.targetId;
      if (ordId) {
        setSelectedCustomerOrderId(ordId);
        setCustomerActiveTab('order-detail');
        onClose();
        return;
      }
      setCustomerActiveTab('orders');
      onClose();
      return;
    }

    if (notif.type === 'chat' && notif.targetId) {
      if (onOpenChat) {
        onOpenChat(notif.targetId);
        onClose();
        return;
      }
    }
  };

  const getNotifIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'restock':
        return <Sparkles className="w-4 h-4 text-emerald-600" />;
      case 'chat':
        return <MessageSquare className="w-4 h-4 text-purple-600" />;
      case 'order':
        return <Package className="w-4 h-4 text-amber-600" />;
      default:
        return <Info className="w-4 h-4 text-blue-600" />;
    }
  };

  const getNotifBadgeColor = (type: AppNotification['type']) => {
    switch (type) {
      case 'restock':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'chat':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'order':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="notifications-title"
    >
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-200 my-auto animate-in zoom-in-95 duration-200 flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-neutral-900 via-neutral-950 to-neutral-900 text-white p-4 sm:p-5 flex items-center justify-between gap-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <BellRing className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="notifications-title" className="font-serif font-bold text-base sm:text-lg text-white">
                  Notifications & Alerts
                </h2>
                {unreadCount > 0 ? (
                  <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black tracking-wide">
                    {unreadCount} NEW
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                    All caught up
                  </span>
                )}
              </div>
              <p className="text-[11px] text-neutral-400">
                Restock alerts, order dispatches, and boutique updates
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white transition cursor-pointer"
            aria-label="Close notifications"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Tabs & Quick Actions Bar */}
        <div className="px-4 py-2.5 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between gap-2 flex-wrap shrink-0">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-neutral-900 text-white shadow-2xs'
                  : 'bg-white text-neutral-600 hover:text-neutral-900 border border-neutral-200'
              }`}
            >
              All ({(customerNotifications || []).length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('order')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === 'order'
                  ? 'bg-neutral-900 text-white shadow-2xs'
                  : 'bg-white text-neutral-600 hover:text-neutral-900 border border-neutral-200'
              }`}
            >
              Orders ({customerNotifications.filter((n) => n.type === 'order').length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('restock')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === 'restock'
                  ? 'bg-neutral-900 text-white shadow-2xs'
                  : 'bg-white text-neutral-600 hover:text-neutral-900 border border-neutral-200'
              }`}
            >
              Restocks ({customerNotifications.filter((n) => n.type === 'restock').length})
            </button>
          </div>

          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllCustomerNotificationsRead}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold text-amber-900 bg-amber-100/70 hover:bg-amber-200/80 transition cursor-pointer"
                title="Mark all notifications as read"
              >
                <CheckCheck className="w-3 h-3" />
                <span className="hidden sm:inline">Mark read</span>
              </button>
            )}
            {customerNotifications.length > 0 && (
              <button
                type="button"
                onClick={clearCustomerNotifications}
                className="p-1.5 rounded-md text-neutral-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                title="Clear all notifications"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Notification List Scroll Area */}
        <div className="p-3 sm:p-4 overflow-y-auto space-y-2.5 flex-1 divide-y divide-neutral-100">
          {filteredNotifications.length === 0 ? (
            <div className="py-12 px-4 text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200/60">
                <Bell className="w-5 h-5" />
              </div>
              <h3 className="font-serif font-bold text-base text-neutral-800">
                No notifications right now
              </h3>
              <p className="text-xs text-neutral-500 max-w-xs mx-auto">
                You're all caught up! New arrivals, restocked pure handlooms, and live order status updates will appear here.
              </p>
            </div>
          ) : (
            filteredNotifications.map((notif) => {
              const isRead = notif.read || notif.isRead;
              return (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`pt-2.5 first:pt-0 group p-3 rounded-2xl border transition-all cursor-pointer relative ${
                    isRead
                      ? 'bg-white hover:bg-neutral-50/80 border-neutral-100'
                      : 'bg-amber-50/40 hover:bg-amber-50/70 border-amber-200/70 shadow-2xs'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon or Product Thumbnail */}
                    {notif.imageUrl ? (
                      <img
                        src={notif.imageUrl}
                        alt="Product preview"
                        className="w-11 h-11 rounded-xl object-cover border border-neutral-200 shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-white border border-neutral-200 flex items-center justify-center shrink-0 shadow-2xs">
                        {getNotifIcon(notif.type)}
                      </div>
                    )}

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${getNotifBadgeColor(notif.type)}`}>
                            {notif.type}
                          </span>
                          {!isRead && (
                            <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0" title="Unread" />
                          )}
                        </div>
                        <span className="text-[10px] text-neutral-400 font-medium shrink-0">
                          {timeAgo(notif.createdAt || notif.timestamp)}
                        </span>
                      </div>

                      <h4 className={`text-xs font-bold leading-tight ${isRead ? 'text-neutral-800' : 'text-neutral-950 font-black'}`}>
                        {notif.title}
                      </h4>

                      <p className="text-[11px] text-neutral-600 line-clamp-2 leading-relaxed">
                        {notif.message}
                      </p>

                      <div className="pt-1 flex items-center justify-between text-[11px] text-amber-800 font-bold group-hover:text-amber-950">
                        <span className="inline-flex items-center gap-1">
                          <span>View Details</span>
                          <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info note */}
        <div className="p-3 bg-neutral-50 border-t border-neutral-200 text-center text-[11px] text-neutral-500 shrink-0">
          Live alerts keep you updated on handloom batches, tracking, and concierge responses.
        </div>
      </div>
    </div>
  );
};
