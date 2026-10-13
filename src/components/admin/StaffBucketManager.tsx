import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { Order, OrderStatus } from '../../types/store';
import { formatPrice, openWhatsApp, formatWhatsAppStageUpdateMessage } from '../../utils/upi';
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
} from 'lucide-react';

interface StaffBucketManagerProps {
  initialStaffId?: string;
  onNavigateToTab?: (tab: 'orders' | 'staff' | 'products' | 'analytics' | 'settings') => void;
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
    assignOrderStaff,
    addOrderWorkLog,
    settings,
  } = useStore();

  const isAdmin = currentUser?.type === 'admin';

  // Determine which bucket to open by default:
  // If user is staff, default to their own bucket; if admin, default to first staff or 'unassigned'
  const defaultBucketId = useMemo(() => {
    if (initialStaffId) return initialStaffId;
    if (currentUser?.staffId) return currentUser.staffId;
    if (staffMembers.length > 0) return staffMembers[0].id;
    return 'unassigned';
  }, [initialStaffId, currentUser, staffMembers]);

  const [activeBucketStaffId, setActiveBucketStaffId] = useState<string>(defaultBucketId);

  React.useEffect(() => {
    if (initialStaffId) {
      setActiveBucketStaffId(initialStaffId);
    }
  }, [initialStaffId]);

  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [bucketSearchQuery, setBucketSearchQuery] = useState('');
  const [selectedDetailOrder, setSelectedDetailOrder] = useState<Order | null>(null);

  // Assignment Modal for staff or reassign
  const [assignModalOrder, setAssignModalOrder] = useState<Order | null>(null);
  const [targetStaffId, setTargetStaffId] = useState('');
  const [assignmentReason, setAssignmentReason] = useState('');

  // Work note modal
  const [workNoteModalOrder, setWorkNoteModalOrder] = useState<Order | null>(null);
  const [workNoteText, setWorkNoteText] = useState('');

  // Active staff details
  const activeStaff = staffMembers.find((s) => s.id === activeBucketStaffId);
  const isViewingMyOwnBucket = currentUser?.staffId === activeBucketStaffId;
  const isViewingUnassigned = activeBucketStaffId === 'unassigned';

  // Orders for current bucket
  const bucketOrders = useMemo(() => {
    return orders.filter((o) => {
      if (isViewingUnassigned) {
        return !o.assignedStaffId || o.assignedStaffId === 'unassigned';
      }
      return o.assignedStaffId === activeBucketStaffId;
    });
  }, [orders, activeBucketStaffId, isViewingUnassigned]);

  // Filtered bucket orders
  const filteredBucketOrders = useMemo(() => {
    return bucketOrders.filter((o) => {
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
  }, [bucketOrders, selectedStatusFilter, bucketSearchQuery]);

  // Metrics for active bucket
  const bucketMetrics = useMemo(() => {
    const total = bucketOrders.length;
    const pending = bucketOrders.filter((o) => o.status === 'Pending').length;
    const confirmed = bucketOrders.filter((o) => o.status === 'Confirmed').length;
    const shipped = bucketOrders.filter((o) => o.status === 'Shipped').length;
    const delivered = bucketOrders.filter((o) => o.status === 'Delivered').length;
    const totalValue = bucketOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    return { total, pending, confirmed, shipped, delivered, totalValue };
  }, [bucketOrders]);

  // Handle cross-staff or self action
  const handleStageChange = (order: Order, newStatus: OrderStatus) => {
    updateOrderStatus(order.id, newStatus);
    if (selectedDetailOrder?.id === order.id) {
      setSelectedDetailOrder((prev) => (prev ? { ...prev, status: newStatus } : null));
    }
  };

  const handleConfirmAssignment = () => {
    if (!assignModalOrder) return;
    if (!targetStaffId) {
      alert('Please select a staff member to assign.');
      return;
    }
    // Staff must state a reason, admin does not have to
    if (!isAdmin && !assignmentReason.trim()) {
      alert('Please state a reason for assigning or reassigning the order. Staff members must record an assignment reason.');
      return;
    }
    const targetStaff = staffMembers.find((s) => s.id === targetStaffId);
    const targetName = targetStaffId === 'admin' ? 'Store Owner' : targetStaff?.name || 'Staff Member';
    const finalReason = assignmentReason.trim() || (isAdmin ? 'Assigned by Store Owner' : 'Assigned to staff');

    assignOrderStaff(assignModalOrder.id, targetStaffId, targetName, finalReason);
    setAssignModalOrder(null);
  };

  const handleAddWorkNote = () => {
    if (!workNoteModalOrder || !workNoteText.trim()) return;
    const actorName = currentUser?.name || 'Staff Member';
    const isOtherStaff = workNoteModalOrder.assignedStaffId && workNoteModalOrder.assignedStaffId !== currentUser?.staffId;
    const notePrefix = isOtherStaff ? `[Note by @${currentUser?.username || 'colleague'}] ` : '';
    addOrderWorkLog(workNoteModalOrder.id, 'Staff Progress Note', `${notePrefix}${workNoteText.trim()}`);
    setWorkNoteModalOrder(null);
    setWorkNoteText('');
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
                  : activeStaff
                  ? `${activeStaff.name} (@${activeStaff.username})`
                  : 'Staff Bucket'}
              </span>
            </h2>
            <p className="text-xs text-neutral-400 mt-1 max-w-2xl leading-relaxed">
              Each staff member can handle their assigned orders separately. Other staff and admins can also view any staff's bucket, assist with work, or reassign orders — every single action is recorded live in the work ledger.
            </p>
          </div>

          {/* Quick Staff Swapping Buttons */}
          <div className="flex items-center gap-2 flex-wrap self-start md:self-auto">
            {currentUser?.staffId && (
              <button
                type="button"
                onClick={() => setActiveBucketStaffId(currentUser.staffId!)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  activeBucketStaffId === currentUser.staffId
                    ? 'bg-amber-500 text-neutral-950 shadow-md'
                    : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>My Bucket</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveBucketStaffId('unassigned')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeBucketStaffId === 'unassigned'
                  ? 'bg-amber-500 text-neutral-950 shadow-md'
                  : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Unassigned ({orders.filter((o) => !o.assignedStaffId).length})</span>
            </button>
          </div>
        </div>

        {/* Staff Bucket Selector Pills Strip */}
        <div className="mt-5 pt-4 border-t border-neutral-800/80 flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider shrink-0 mr-1">
            Switch Staff Bucket:
          </span>
          {staffMembers.map((staff) => {
            const count = orders.filter((o) => o.assignedStaffId === staff.id).length;
            const isSelected = activeBucketStaffId === staff.id;
            const isMe = currentUser?.staffId === staff.id;

            return (
              <button
                key={staff.id}
                type="button"
                onClick={() => setActiveBucketStaffId(staff.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition flex items-center gap-2 cursor-pointer border ${
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

      {/* Metrics Row for Selected Bucket */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-neutral-200/90 shadow-2xs">
          <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">Total in Bucket</span>
          <p className="font-serif text-2xl font-bold text-neutral-950 mt-0.5">{bucketMetrics.total}</p>
          <span className="text-[11px] text-neutral-500 font-semibold">{formatPrice(bucketMetrics.totalValue)}</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-amber-200 bg-amber-50/20 shadow-2xs">
          <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">Pending</span>
          <p className="font-serif text-2xl font-bold text-amber-700 mt-0.5">{bucketMetrics.pending}</p>
          <span className="text-[10px] text-neutral-500">Intake / verify</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-purple-200 bg-purple-50/20 shadow-2xs">
          <span className="text-[10px] font-bold text-purple-800 uppercase tracking-wider block">Confirmed</span>
          <p className="font-serif text-2xl font-bold text-purple-700 mt-0.5">{bucketMetrics.confirmed}</p>
          <span className="text-[10px] text-neutral-500">Loom reserving</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-blue-200 bg-blue-50/20 shadow-2xs">
          <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block">Shipped</span>
          <p className="font-serif text-2xl font-bold text-blue-700 mt-0.5">{bucketMetrics.shipped}</p>
          <span className="text-[10px] text-neutral-500">In courier transit</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-2xs">
          <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Delivered</span>
          <p className="font-serif text-2xl font-bold text-emerald-700 mt-0.5">{bucketMetrics.delivered}</p>
          <span className="text-[10px] text-neutral-500">Closed deal ✓</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-neutral-200 flex flex-col justify-center shadow-2xs">
          <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">Staff Role</span>
          <p className="font-bold text-xs text-neutral-900 capitalize mt-0.5 truncate">
            {isViewingUnassigned ? 'Intake Queue' : activeStaff?.role || 'Boutique Staff'}
          </p>
          <span className="text-[10px] text-neutral-500 font-mono truncate">
            {isViewingUnassigned ? 'Public Store' : `@${activeStaff?.username || 'staff'}`}
          </span>
        </div>
      </div>

      {/* Filter and Search Bar for Bucket */}
      <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
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
            const isAssignedToMe = currentUser?.staffId === order.assignedStaffId;
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

                  {/* Actions Row */}
                  <div className="flex items-center justify-between gap-1.5 pt-1">
                    {/* View Details Button */}
                    <button
                      type="button"
                      onClick={() => setSelectedDetailOrder(order)}
                      className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
                    >
                      <span>View Details</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>

                    <div className="flex items-center gap-1">
                      {/* Work note */}
                      <button
                        type="button"
                        onClick={() => {
                          setWorkNoteModalOrder(order);
                          setWorkNoteText('');
                        }}
                        className="p-1.5 rounded-lg border border-neutral-300 hover:bg-neutral-100 text-neutral-700 transition"
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
                        className="p-1.5 rounded-lg border border-neutral-300 hover:bg-neutral-100 text-neutral-700 transition"
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

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAssignModalOrder(selectedDetailOrder);
                      setTargetStaffId(selectedDetailOrder.assignedStaffId || (staffMembers[0]?.id || ''));
                      setAssignmentReason('');
                    }}
                    className="px-3.5 py-2 rounded-xl border border-neutral-300 hover:bg-neutral-100 text-neutral-800 font-semibold transition"
                  >
                    Reassign Staff
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedDetailOrder(null)}
                    className="px-4 py-2 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white font-bold transition"
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
    </div>
  );
};
