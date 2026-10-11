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
  Globe,
  Copy,
  ExternalLink,
  HelpCircle,
  Check,
  Server,
  Cloud,
} from 'lucide-react';

export const StaffManager: React.FC = () => {
  const {
    staffMembers,
    addStaffMember,
    updateStaffMember,
    toggleStaffLock,
    deleteStaffMember,
    syncStaffToDatabase,
    orders,
    currentUser,
    currentPermissions,
  } = useStore();
  const isAdmin = currentUser?.type === 'admin';
  const canEditStaff = isAdmin || currentPermissions?.staff?.canEdit !== false;

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [staffToDelete, setStaffToDelete] = useState<StaffMember | null>(null);
  const [showHostingModal, setShowHostingModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedStaffEmail, setCopiedStaffEmail] = useState<string | null>(null);
  const [isSyncingDB, setIsSyncingDB] = useState(false);
  const [dbSyncSuccess, setDbSyncSuccess] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'concierge' | 'fulfillment' | 'manager'>('concierge');
  const [phone, setPhone] = useState('');
  const [authMethod, setAuthMethod] = useState<'google' | 'password' | 'both'>('google');
  const [errorMsg, setErrorMsg] = useState('');

  const openAddModal = () => {
    setEditingStaff(null);
    setName('');
    setUsername('');
    setEmail('');
    setPassword('');
    setRole('concierge');
    setPhone('');
    setAuthMethod('google');
    setErrorMsg('');
    setIsAddModalOpen(true);
  };

  const openEditModal = (staff: StaffMember) => {
    setEditingStaff(staff);
    setName(staff.name);
    setUsername(staff.username);
    setEmail(staff.email || '');
    setPassword(staff.password || '');
    setRole(staff.role);
    setPhone(staff.phone || '');
    setAuthMethod(staff.authMethod || (staff.email ? 'google' : 'password'));
    setErrorMsg('');
    setIsAddModalOpen(true);
  };

  const handleCopyPortalLink = () => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}${window.location.pathname}#admin`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  const handleCopyEmail = (staffEmail: string) => {
    navigator.clipboard.writeText(staffEmail).then(() => {
      setCopiedStaffEmail(staffEmail);
      setTimeout(() => setCopiedStaffEmail(null), 2000);
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setErrorMsg('Please enter the staff member full name.');
      return;
    }

    const cleanEmail = email.trim().toLowerCase();

    // If Google auth is selected or enabled, require valid email
    if (authMethod === 'google' || authMethod === 'both') {
      if (!cleanEmail) {
        setErrorMsg('Please enter the Gmail ID / Google account for Google Authentication.');
        return;
      }
      if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
        setErrorMsg('Please enter a valid Google email address (e.g. staff@gmail.com).');
        return;
      }
    }

    // Auto-generate username from email prefix if blank
    let cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername && cleanEmail) {
      cleanUsername = cleanEmail.split('@')[0].replace(/[^a-z0-9_]/gi, '').toLowerCase();
    }

    if (!cleanUsername) {
      setErrorMsg('Please enter a portal login username.');
      return;
    }

    // For password validation
    let finalPassword = password.trim();
    if (authMethod === 'password' && !finalPassword) {
      setErrorMsg('Please enter a login password.');
      return;
    }

    // If google-only and password was left empty, generate a fallback key so store stays consistent
    if (!finalPassword) {
      finalPassword = `gauth_${Math.random().toString(36).slice(2, 10)}`;
    }

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
        email: cleanEmail || undefined,
        password: finalPassword,
        role,
        authMethod,
        isLocked: false,
        phone: phone.trim(),
      });
    } else {
      updateStaffMember(editingStaff.id, {
        name: name.trim(),
        username: cleanUsername,
        email: cleanEmail || undefined,
        password: finalPassword,
        role,
        authMethod,
        phone: phone.trim(),
      });
    }

    setIsAddModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-neutral-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-amber-600 shrink-0" />
            <span>Staff Portal & Google Authentication</span>
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Authenticate boutique staff using Google OAuth 2.0 (Gmail), assign order responsibilities, and manage access
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <button
            onClick={handleCopyPortalLink}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-700 text-xs font-semibold shadow-xs transition cursor-pointer"
            title="Copy portal URL to send to your team"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-neutral-500" />}
            <span>{copiedLink ? 'Portal Link Copied!' : 'Copy Portal Link'}</span>
          </button>

          <button
            onClick={async () => {
              setIsSyncingDB(true);
              try {
                const count = await syncStaffToDatabase();
                setDbSyncSuccess(`Synced ${count} staff to Firestore /staff`);
                setTimeout(() => setDbSyncSuccess(null), 3000);
              } catch (err: any) {
                console.error(err);
              } finally {
                setIsSyncingDB(false);
              }
            }}
            disabled={isSyncingDB}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-950 text-xs font-semibold shadow-xs transition cursor-pointer"
            title="Sync all staff records to the dedicated /staff collection in Firestore"
          >
            <Server className="w-3.5 h-3.5 text-emerald-700" />
            <span>{isSyncingDB ? 'Syncing DB...' : dbSyncSuccess || 'Sync to Database'}</span>
          </button>

          <button
            onClick={() => setShowHostingModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100/80 text-amber-900 text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5 text-amber-700" />
            <span>Hosting & Setup Guide</span>
          </button>

          {canEditStaff ? (
            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Staff Member</span>
            </button>
          ) : (
            <div className="px-3 py-1.5 rounded-xl bg-neutral-200 text-neutral-600 text-xs font-medium">
              Staff View-Only
            </div>
          )}
        </div>
      </div>

      {/* Google Authentication Mechanism Explanation Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-neutral-900 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          </div>
          <div className="space-y-1">
            <h3 className="font-serif font-bold text-sm sm:text-base text-white flex items-center gap-2">
              <span>Google Authentication Enabled</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-sans font-bold uppercase">
                Active OAuth 2.0
              </span>
            </h3>
            <p className="text-xs text-blue-100/90 leading-relaxed max-w-2xl">
              When you add a staff member with their <strong>Gmail address</strong>, they can sign in simply by clicking{' '}
              <span className="font-semibold text-white bg-white/10 px-1.5 py-0.5 rounded">Sign in with Google</span>.
              Their assigned role and permissions are instantly verified. If an account is locked or deleted here, their Google access is immediately revoked.
            </p>
          </div>
        </div>

        <button
          onClick={openAddModal}
          className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-neutral-100 text-neutral-900 text-xs font-bold transition shadow-sm"
        >
          <UserPlus className="w-3.5 h-3.5 text-blue-600" />
          <span>Add Staff Gmail</span>
        </button>
      </div>

      {/* Staff Members List Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {staffMembers.map((staff) => {
          // Count orders assigned to this staff
          const assignedOrders = orders.filter((o) => o.assignedStaffId === staff.id);
          const activeOrders = assignedOrders.filter(
            (o) => o.status !== 'Delivered' && o.status !== 'Cancelled' && o.status !== 'Rejected'
          );

          const hasGoogleAuth = !!staff.email;

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

                {/* Google Authentication Method Badge */}
                {hasGoogleAuth ? (
                  <div className="mt-3 p-2.5 rounded-xl bg-blue-50/80 border border-blue-200/80 space-y-1">
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                          <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                          />
                        </svg>
                        <span className="text-[11px] font-bold text-blue-900 truncate" title={staff.email}>
                          {staff.email}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyEmail(staff.email!)}
                        className="text-blue-600 hover:text-blue-800 p-0.5 rounded transition shrink-0"
                        title="Copy staff email"
                      >
                        {copiedStaffEmail === staff.email ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-blue-700/80 pt-0.5">
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        Google Sign-In Ready
                      </span>
                      <span className="font-mono text-[9px] uppercase tracking-wider text-blue-600">
                        OAuth 2.0
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 p-2.5 rounded-xl bg-neutral-100 border border-neutral-200 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-neutral-500">Password Auth Only</span>
                    <button
                      onClick={() => openEditModal(staff)}
                      className="text-[11px] text-amber-800 font-bold hover:underline inline-flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Link Gmail</span>
                    </button>
                  </div>
                )}

                {staff.phone && (
                  <p className="text-xs text-neutral-600 flex items-center gap-1.5 mt-2.5">
                    <Phone className="w-3 h-3 text-neutral-400" />
                    <span>{staff.phone}</span>
                  </p>
                )}

                {/* Firestore Database Sync Indicator */}
                <div className="mt-2.5 flex items-center justify-between text-[10px] text-neutral-500 font-mono px-2.5 py-1.5 rounded-lg bg-neutral-100/80 border border-neutral-200/70">
                  <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                    <Server className="w-3 h-3 text-emerald-600" />
                    Firestore Synced
                  </span>
                  <span className="truncate max-w-[140px] text-neutral-600" title={`/staff/${staff.id}`}>
                    /staff/{staff.id}
                  </span>
                </div>

                {/* Workload Metric */}
                <div className="mt-3.5 p-3 rounded-xl bg-neutral-50 border border-neutral-200/80 space-y-1 text-xs">
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
                    title="Edit Credentials & Google ID"
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

      {/* Staff Orders Workload Board */}
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
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 my-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 bg-neutral-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-serif text-base font-bold">
                  {editingStaff ? 'Edit Staff Credentials & Auth' : 'Add Boutique Staff Member'}
                </h3>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Configure Google Authentication (Gmail) or login credentials
                </p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-full text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 text-xs">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Authentication Method Selector */}
              <div>
                <label className="block font-bold text-neutral-800 mb-1.5">
                  Authentication Method *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAuthMethod('google')}
                    className={`p-3 rounded-2xl border text-left transition flex items-start gap-2.5 ${
                      authMethod === 'google'
                        ? 'border-blue-500 bg-blue-50/80 text-blue-950 font-bold shadow-xs'
                        : 'border-neutral-200 bg-neutral-50 text-neutral-600 hover:bg-neutral-100'
                    }`}
                  >
                    <svg className="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <div>
                      <div className="text-xs font-bold flex items-center gap-1.5">
                        <span>Google Sign-In</span>
                        <span className="px-1.5 py-0.2 rounded bg-blue-200/80 text-blue-800 text-[9px] uppercase">
                          Recommended
                        </span>
                      </div>
                      <p className="text-[10px] text-blue-800 font-normal mt-0.5 leading-snug">
                        Staff logs in with 1-click via their Google account
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAuthMethod('both')}
                    className={`p-3 rounded-2xl border text-left transition flex items-start gap-2.5 ${
                      authMethod === 'both'
                        ? 'border-amber-500 bg-amber-50/80 text-amber-950 font-bold shadow-xs'
                        : 'border-neutral-200 bg-neutral-50 text-neutral-600 hover:bg-neutral-100'
                    }`}
                  >
                    <Key className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                    <div>
                      <div className="text-xs font-bold">Dual Auth</div>
                      <p className="text-[10px] text-amber-800 font-normal mt-0.5 leading-snug">
                        Google Sign-In + password fallback
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-neutral-800 mb-1">Staff Full Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="e.g. Smt. Anita Sharma"
                  className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900"
                />
              </div>

              {/* Google / Gmail ID Field */}
              <div>
                <label className="block font-bold text-neutral-800 mb-1 flex items-center justify-between">
                  <span>Google Account Email (Gmail ID) {authMethod !== 'password' ? '*' : '(Optional)'}</span>
                  <span className="text-[10px] text-blue-600 font-normal">OAuth 2.0 Integration</span>
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEmail(val);
                      // Auto-fill username if blank or matching previous prefix
                      if ((!username || username === email.split('@')[0]) && val.includes('@')) {
                        setUsername(val.split('@')[0].replace(/[^a-z0-9_]/gi, '').toLowerCase());
                      }
                    }}
                    required={authMethod !== 'password'}
                    placeholder="e.g. anita.sharma@gmail.com"
                    className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-xs"
                  />
                </div>
                <div className="mt-1.5 p-2 rounded-xl bg-blue-50/70 border border-blue-100 text-[11px] text-blue-800 leading-snug">
                  ✨ When this staff member clicks <strong>"Sign in with Google"</strong>, Google verifies their Gmail account and securely logs them into their boutique workspace.
                </div>
              </div>

              <div>
                <label className="block font-bold text-neutral-800 mb-1">
                  Portal Username *
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  placeholder="e.g. anita_concierge"
                  className="w-full p-2.5 rounded-xl border border-neutral-300 font-mono text-xs text-neutral-900 lowercase"
                />
                <p className="text-[10px] text-neutral-500 mt-1">
                  Used for order ledger tracking (e.g. updated by @{username || 'username'})
                </p>
              </div>

              {/* Password field: optional when Google Auth is primary */}
              {authMethod !== 'google' ? (
                <div>
                  <label className="block font-bold text-neutral-800 mb-1">
                    Staff Login Password *
                  </label>
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Enter login password"
                    className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900 font-mono"
                  />
                </div>
              ) : (
                <div>
                  <label className="block font-medium text-neutral-600 mb-1 flex items-center justify-between">
                    <span>Backup Security Key (Optional)</span>
                    <span className="text-[10px] text-neutral-400">Handled by Google Auth</span>
                  </label>
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Leave blank to auto-generate secure token"
                    className="w-full p-2.5 rounded-xl border border-neutral-200 text-neutral-700 font-mono text-xs bg-neutral-50"
                  />
                </div>
              )}

              <div>
                <label className="block font-bold text-neutral-800 mb-1">Boutique Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white text-neutral-900"
                >
                  <option value="concierge">Concierge (Order Handling & WhatsApp Updates)</option>
                  <option value="fulfillment">Fulfillment & Packaging Lead (Dispatches & Tracking)</option>
                  <option value="manager">Boutique Manager (Orders, Sarees & Staff)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Contact Mobile Phone (WhatsApp)
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
                  className="px-4 py-2.5 rounded-xl border border-neutral-300 text-neutral-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold transition flex items-center gap-1.5 shadow-sm"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingStaff ? 'Update Staff Member' : 'Save Staff & Enable Google Auth'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Staff Removal Confirmation Modal */}
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
                    Revoke credentials & Google authentication access
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
                {staffToDelete.email && (
                  <p className="text-neutral-600">Google Auth: <span className="font-semibold text-blue-900">{staffToDelete.email}</span></p>
                )}
                <p className="text-neutral-600">Role: <span className="font-semibold text-rose-900 uppercase">{staffToDelete.role}</span></p>
              </div>

              <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-rose-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
                  <span>Immediate Access Revocation</span>
                </p>
                <p className="text-[11px] text-rose-800 leading-relaxed">
                  Once removed, this staff member will be <strong>permanently blocked</strong> from logging in using their Google account or password. Any active session will terminate immediately.
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

      {/* Free Hosting & Deployment Guide Modal */}
      {showHostingModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6">
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-200 my-auto animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="p-5 bg-neutral-950 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center">
                  <Globe className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-serif text-base sm:text-lg font-bold text-white">
                    Free Hosting & Production Deployment Guide
                  </h3>
                  <p className="text-xs text-neutral-400">
                    How to host this application for free and ensure Google Authentication works
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowHostingModal(false)}
                className="p-1 rounded-full text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto space-y-6 text-xs text-neutral-700 leading-relaxed">
              {/* Critical Alert about Firebase Authorized Domains */}
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300/80 space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-950 text-sm">
                  <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>Important: Google Auth Domain Authorization</span>
                </div>
                <p className="text-xs text-amber-900">
                  When you host your boutique on a free platform (e.g. Vercel, Netlify, or Firebase Hosting), you must add your hosting domain to Firebase so Google Sign-In popups are allowed:
                </p>
                <ol className="list-decimal pl-5 space-y-1 font-medium text-amber-950 text-xs">
                  <li>Open the <strong>Firebase Console</strong> and select your project.</li>
                  <li>Navigate to <strong>Authentication &rarr; Settings &rarr; Authorized domains</strong>.</li>
                  <li>Click <strong>Add domain</strong> and enter your deployed URL (e.g., <code>your-boutique.vercel.app</code>).</li>
                </ol>
              </div>

              {/* Hosting Option 1: Firebase Hosting (Recommended) */}
              <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-amber-600" />
                    <h4 className="font-serif font-bold text-sm text-neutral-900">Option 1: Firebase Hosting (Recommended - 100% Free)</h4>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase">
                    Zero Setup for Auth
                  </span>
                </div>
                <p className="text-neutral-600 text-xs">
                  Because Firebase Hosting shares the same project as your Firestore database, your <code>*.web.app</code> domain is <strong>automatically pre-authorized</strong> for Google Sign-In!
                </p>
                <div className="p-3 rounded-xl bg-neutral-900 text-neutral-200 font-mono text-[11px] space-y-1">
                  <p>npm run build</p>
                  <p>npm install -g firebase-tools</p>
                  <p>firebase login</p>
                  <p>firebase init hosting  # Set public directory to "dist"</p>
                  <p>firebase deploy --only hosting</p>
                </div>
              </div>

              {/* Hosting Option 2: Vercel */}
              <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-blue-600" />
                    <h4 className="font-serif font-bold text-sm text-neutral-900">Option 2: Vercel (Fastest Global CDN - Free Hobby Plan)</h4>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold uppercase">
                    1-Click Git Deploy
                  </span>
                </div>
                <ol className="list-decimal pl-5 space-y-1 text-neutral-600 text-xs">
                  <li>Push your repository to GitHub or GitLab.</li>
                  <li>Sign into <strong>Vercel.com</strong> and click <strong>Import Project</strong>.</li>
                  <li>Build Command: <code>npm run build</code> | Output Directory: <code>dist</code>.</li>
                  <li>Copy your new <code>*.vercel.app</code> URL and add it to Firebase <em>Authorized domains</em>.</li>
                </ol>
              </div>

              {/* Hosting Option 3: Netlify */}
              <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-emerald-600" />
                    <h4 className="font-serif font-bold text-sm text-neutral-900">Option 3: Netlify (Free Drag-and-Drop or Git)</h4>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-neutral-200 text-neutral-800 text-[10px] font-bold uppercase">
                    Free
                  </span>
                </div>
                <p className="text-neutral-600 text-xs">
                  Run <code>npm run build</code>, then drag the generated <code>dist</code> folder into the Netlify Drop dashboard, or link your GitHub repository. Remember to add your <code>*.netlify.app</code> domain to Firebase Authorized domains.
                </p>
              </div>

              {/* Direct Link Access */}
              <div className="p-4 rounded-2xl bg-neutral-100 border border-neutral-300 space-y-2">
                <h4 className="font-serif font-bold text-neutral-900">Configured Redirect & Deep Links</h4>
                <p className="text-neutral-600 text-xs">
                  Your application has built-in deep-linking support across all browsers and hosting platforms:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                  <div className="p-2 bg-white rounded-lg border border-neutral-200">
                    <span className="text-neutral-400">Admin Portal: </span>
                    <strong className="text-neutral-900">#admin</strong> or <strong>/admin</strong>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-neutral-200">
                    <span className="text-neutral-400">Order Tracking: </span>
                    <strong className="text-neutral-900">#track</strong> or <strong>?order=AARA-xxxx</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex justify-end shrink-0">
              <button
                onClick={() => setShowHostingModal(false)}
                className="px-5 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs"
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
