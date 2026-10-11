import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { StaffMember } from '../../types/store';
import { formatPrice } from '../../utils/upi';
import {
  Users,
  UserPlus,
  Lock,
  Unlock,
  Key,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Package,
  Phone,
  Shield,
  Clock,
  X,
  Plus,
  AlertCircle,
} from 'lucide-react';

export const StaffManager: React.FC = () => {
  const { staffMembers, addStaffMember, updateStaffMember, toggleStaffLock, deleteStaffMember, orders, currentUser, currentPermissions } = useStore();
  const isAdmin = currentUser?.type === 'admin';
  const canEditStaff = isAdmin || currentPermissions?.staff?.canEdit !== false;

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [staffToDelete, setStaffToDelete] = useState<StaffMember | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'concierge' | 'fulfillment' | 'manager'>('concierge');
  const [phone, setPhone] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const openAddModal = () => {
    setEditingStaff(null);
    setName('');
    setUsername('');
    setPassword('');
    setRole('concierge');
    setPhone('');
    setErrorMsg('');
    setIsAddModalOpen(true);
  };

  const openEditModal = (staff: StaffMember) => {
    setEditingStaff(staff);
    setName(staff.name);
    setUsername(staff.username);
    setPassword(staff.password);
    setRole(staff.role);
    setPhone(staff.phone || '');
    setErrorMsg('');
    setIsAddModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !username.trim() || !password.trim()) {
      setErrorMsg('Please enter name, username, and password.');
      return;
    }

    const cleanUsername = username.trim().toLowerCase();

    // Check duplicate username if adding new
    if (!editingStaff) {
      const exists = staffMembers.some((s) => s.username.toLowerCase() === cleanUsername);
      if (exists) {
        setErrorMsg('Username already taken. Please choose another username.');
        return;
      }

      addStaffMember({
        name: name.trim(),
        username: cleanUsername,
        password: password.trim(),
        role,
        isLocked: false,
        phone: phone.trim(),
      });
    } else {
      updateStaffMember(editingStaff.id, {
        name: name.trim(),
        username: cleanUsername,
        password: password.trim(),
        role,
        phone: phone.trim(),
      });
    }

    setIsAddModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-neutral-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-amber-600" />
            <span>Staff Portal & Order Workload Management</span>
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Create boutique staff credentials, lock/unlock accounts, and assign order responsibilities
          </p>
        </div>

        {canEditStaff ? (
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold shadow-xs transition"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Staff Member</span>
          </button>
        ) : (
          <div className="px-3 py-1.5 rounded-xl bg-neutral-200 text-neutral-600 text-xs font-medium">
            Staff View-Only
          </div>
        )}
      </div>

      {/* Staff Members List Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {staffMembers.map((staff) => {
          // Count orders assigned to this staff
          const assignedOrders = orders.filter((o) => o.assignedStaffId === staff.id);
          const activeOrders = assignedOrders.filter(
            (o) => o.status !== 'Delivered' && o.status !== 'Cancelled' && o.status !== 'Rejected'
          );

          return (
            <div
              key={staff.id}
              className={`p-5 rounded-2xl border transition shadow-xs flex flex-col justify-between ${
                staff.isLocked
                  ? 'bg-neutral-100/80 border-neutral-300 opacity-80'
                  : 'bg-white border-neutral-200'
              }`}
            >
              <div>
                {/* Status & Role Pill */}
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                      staff.role === 'manager'
                        ? 'bg-purple-100 text-purple-800'
                        : staff.role === 'fulfillment'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {staff.role}
                  </span>

                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      staff.isLocked
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {staff.isLocked ? (
                      <>
                        <Lock className="w-3 h-3" />
                        <span>Locked</span>
                      </>
                    ) : (
                      <>
                        <Unlock className="w-3 h-3" />
                        <span>Active</span>
                      </>
                    )}
                  </span>
                </div>

                <h3 className="font-serif text-lg font-bold text-neutral-900">{staff.name}</h3>
                <p className="font-mono text-xs text-neutral-500 mt-0.5">@{staff.username}</p>

                {staff.phone && (
                  <p className="text-xs text-neutral-600 flex items-center gap-1.5 mt-2">
                    <Phone className="w-3 h-3 text-neutral-400" />
                    <span>{staff.phone}</span>
                  </p>
                )}

                {/* Workload Metric */}
                <div className="mt-4 p-3 rounded-xl bg-neutral-50 border border-neutral-200/80 space-y-1 text-xs">
                  <div className="flex justify-between font-semibold text-neutral-700">
                    <span>Active Assigned Orders:</span>
                    <span className="text-amber-800 font-bold">{activeOrders.length}</span>
                  </div>
                  <div className="flex justify-between text-neutral-500 text-[11px]">
                    <span>Total Lifetime Handled:</span>
                    <span>{assignedOrders.length} orders</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 mt-4 border-t border-neutral-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => toggleStaffLock(staff.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                    staff.isLocked
                      ? 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                      : 'border-rose-300 text-rose-700 hover:bg-rose-50'
                  }`}
                  title={staff.isLocked ? 'Unlock account' : 'Lock account (prohibit sign-in)'}
                >
                  {staff.isLocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  <span>{staff.isLocked ? 'Unlock' : 'Lock'}</span>
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => openEditModal(staff)}
                    className="p-1.5 rounded-lg text-neutral-600 hover:bg-neutral-100"
                    title="Edit Credentials"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setStaffToDelete(staff)}
                    className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50"
                    title="Remove Staff"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Staff Orders Workload Board (Prompt Request: in the admin page create a page where it shows which order with staff handles) */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-5 sm:p-6 shadow-xs space-y-4">
        <div>
          <h3 className="font-serif text-lg font-bold text-neutral-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-amber-600" />
            <span>Staff Order Assignments Ledger</span>
          </h3>
          <p className="text-xs text-neutral-500">
            Current assignment distribution showing which boutique staff handles each client order
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 uppercase font-semibold text-[11px]">
              <tr>
                <th className="py-3 px-3">Order Number</th>
                <th className="py-3 px-3">Customer</th>
                <th className="py-3 px-3">Items</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Assigned Staff</th>
                <th className="py-3 px-3">Last Updated By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {orders.map((ord) => {
                const assignedStaff = staffMembers.find((s) => s.id === ord.assignedStaffId);
                return (
                  <tr key={ord.id} className="hover:bg-neutral-50/60 transition">
                    <td className="py-3 px-3 font-mono font-bold text-rose-950">
                      #{ord.orderNumber}
                    </td>
                    <td className="py-3 px-3">
                      <p className="font-semibold text-neutral-900">{ord.customer.name}</p>
                      <p className="text-[11px] text-neutral-500">{ord.customer.phone}</p>
                    </td>
                    <td className="py-3 px-3">
                      <p className="font-medium text-neutral-800">{ord.items.length} saree(s)</p>
                      <p className="text-[11px] text-neutral-500">{formatPrice(ord.totalAmount)}</p>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-bold text-[11px] px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-800">
                        {ord.status}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {ord.assignedStaffName ? (
                        <div className="flex items-center gap-1.5">
                          <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold flex items-center justify-center">
                            {ord.assignedStaffName.charAt(0)}
                          </span>
                          <div>
                            <p className="font-bold text-neutral-900">{ord.assignedStaffName}</p>
                            {assignedStaff && (
                              <p className="text-[10px] text-neutral-500 font-mono">
                                @{assignedStaff.username}
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-neutral-400 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-neutral-500">
                      {ord.lastUpdatedBy ? `@${ord.lastUpdatedBy}` : 'system'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Staff Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 my-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 bg-neutral-900 text-white flex items-center justify-between">
              <h3 className="font-serif text-base font-bold">
                {editingStaff ? 'Edit Staff Credentials' : 'Add Boutique Staff Member'}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-full text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
              {errorMsg && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block font-bold text-neutral-800 mb-1">Staff Full Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="e.g. Smt. Meenakshi Sundaram"
                  className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-800 mb-1">
                  Portal Login Username *
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  placeholder="e.g. meenakshi_concierge"
                  className="w-full p-2.5 rounded-xl border border-neutral-300 font-mono text-xs text-neutral-900 lowercase"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-800 mb-1">Login Password *</label>
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Password for portal sign-in"
                  className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-800 mb-1">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white text-neutral-900"
                >
                  <option value="concierge">Concierge (Order Handling & WhatsApp)</option>
                  <option value="fulfillment">Fulfillment & Packaging Lead</option>
                  <option value="manager">Boutique Manager</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Contact Mobile Phone
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+919876543210"
                  className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-neutral-300 text-neutral-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold"
                >
                  {editingStaff ? 'Update Staff' : 'Create Staff Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Staff Removal Confirmation Modal (Prompt Request: Once removed, staff cannot log in) */}
      {staffToDelete && (
        <div className="fixed inset-0 z-60 overflow-y-auto bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 my-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 bg-neutral-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  <Trash2 className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <h3 className="font-serif text-base font-bold text-white">
                    Remove Staff Member
                  </h3>
                  <p className="text-[11px] text-neutral-400">
                    Revoke credentials & boutique console access
                  </p>
                </div>
              </div>
              <button
                onClick={() => setStaffToDelete(null)}
                className="p-1 rounded-full text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-1">
                <p className="font-bold text-sm text-neutral-900">{staffToDelete.name}</p>
                <p className="text-neutral-600">Username: <strong className="text-neutral-900 font-mono">@{staffToDelete.username}</strong></p>
                <p className="text-neutral-600">Role: <span className="font-semibold text-rose-900 uppercase">{staffToDelete.role}</span></p>
                <p className="text-neutral-600">Phone: {staffToDelete.phone || 'Not specified'}</p>
              </div>

              <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-rose-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
                  <span>Permanent Access Revocation</span>
                </p>
                <p className="text-[11px] text-rose-800 leading-relaxed">
                  Once removed, this staff member will be <strong>permanently barred from logging into the staff login portal</strong>. Even with their old credentials or username, they will not be able to sign in.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setStaffToDelete(null)}
                  className="py-2.5 px-4 rounded-xl border border-neutral-300 hover:bg-neutral-100 text-neutral-700 font-semibold transition text-center"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    deleteStaffMember(staffToDelete.id);
                    setStaffToDelete(null);
                  }}
                  className="py-2.5 px-4 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold transition flex items-center justify-center gap-1.5 shadow-sm shadow-rose-900/30"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Yes, Revoke & Remove</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
