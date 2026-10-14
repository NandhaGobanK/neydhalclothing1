import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { StaffMember, Order, OrderStatus } from '../../types/store';
import { formatPrice } from '../../utils/upi';
import { syncStaffLedgerToGoogleSheet } from '../../utils/googleSheets';
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
  FileSpreadsheet,
  Download,
  RefreshCw,
  Activity,
  ShieldCheck,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  History,
  ArrowRight,
  BarChart3,
  Layers,
  UserCheck,
  Edit,
  MessageSquare,
  Crown,
  LogOut,
  UserX,
} from 'lucide-react';
import { StaffPerformanceBoard } from './StaffPerformanceBoard';
import { formatDeviceDateTime, formatDeviceTime, formatDeviceDate } from '../../utils/deviceTime';

interface StaffManagerProps {
  onNavigateToBucket?: (staffId: string) => void;
}

export const StaffManager: React.FC<StaffManagerProps> = ({ onNavigateToBucket }) => {
  const {
    staffMembers,
    addStaffMember,
    updateStaffMember,
    toggleStaffLock,
    deleteStaffMember,
    syncStaffToDatabase,
    orders,
    settings,
    updateSettings,
    currentUser,
    currentPermissions,
    adminOnlineStatus,
    updateOrderStatus,
    assignOrderStaff,
    addOrderWorkLog,
    forceLogoutStaff,
  } = useStore();
  const isAdmin = currentUser?.type === 'admin';
  const canEditStaff = isAdmin || currentPermissions?.staff?.canEdit !== false;

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [staffToDelete, setStaffToDelete] = useState<StaffMember | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedStaffEmail, setCopiedStaffEmail] = useState<string | null>(null);
  const [isSyncingDB, setIsSyncingDB] = useState(false);
  const [dbSyncSuccess, setDbSyncSuccess] = useState<string | null>(null);
  const [loggedOutNotice, setLoggedOutNotice] = useState<string | null>(null);
  const [showPunchModal, setShowPunchModal] = useState(false);

  const handleRemoteLogoutStaff = async (staffId: string, staffName: string) => {
    try {
      await forceLogoutStaff(staffId);
      setLoggedOutNotice(`Successfully logged out ${staffName}. Their active device session was terminated.`);
      setTimeout(() => setLoggedOutNotice(null), 4000);
    } catch (err: any) {
      alert(`Failed to logout user: ${err?.message || 'Unknown error'}`);
    }
  };

  // Staff & Ledger Google Sheets Sync & CSV Export (User Request)
  const [isSyncingLedger, setIsSyncingLedger] = useState(false);
  const [ledgerSyncSuccess, setLedgerSyncSuccess] = useState<{ url: string; count: number } | null>(null);
  const [ledgerSyncError, setLedgerSyncError] = useState<string | null>(null);
  const [showPerformanceBoard, setShowPerformanceBoard] = useState(false);

  const handleSyncLedger = async () => {
    setIsSyncingLedger(true);
    setLedgerSyncSuccess(null);
    setLedgerSyncError(null);

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
        setLedgerSyncSuccess({ url: res.spreadsheetUrl, count: res.rowsUpdated });
        updateSettings({
          ordersSpreadsheetId: res.spreadsheetId,
          ordersSpreadsheetUrl: res.spreadsheetUrl,
          analyticsSpreadsheetId: res.spreadsheetId,
          analyticsSpreadsheetUrl: res.spreadsheetUrl,
        });
      }
    } catch (err: any) {
      setLedgerSyncError(err?.message || 'Failed to sync ledger with Google Sheets');
    } finally {
      setIsSyncingLedger(false);
    }
  };

  const handleExportLedgerCsv = () => {
    const headers = [
      'Order Number',
      'Customer Name',
      'Customer Phone',
      'Order Status',
      'Order Total (₹)',
      'Assigned Boutique Staff',
      'Staff Username',
      'Staff Role',
      'Last Work / Handover Action',
    ];

    const rows = orders.map((ord) => {
      const assigned = staffMembers.find((s) => s.id === ord.assignedStaffId);
      const lastLog = ord.assignmentHistory && ord.assignmentHistory.length > 0
        ? ord.assignmentHistory[ord.assignmentHistory.length - 1]
        : null;
      const lastLogText = lastLog
        ? `[${new Date(lastLog.timestamp).toLocaleTimeString('en-IN')}] ${lastLog.staffName}: ${lastLog.action}${lastLog.note ? ` (${lastLog.note})` : ''}`
        : 'Initial assignment';

      return [
        ord.orderNumber,
        `"${ord.customer.name}"`,
        `"${ord.customer.phone}"`,
        ord.status,
        ord.totalAmount,
        `"${ord.assignedStaffName || 'Unassigned'}"`,
        `"${assigned ? `@${assigned.username}` : (ord.lastUpdatedBy ? `@${ord.lastUpdatedBy}` : '')}"`,
        `"${assigned ? assigned.role : ''}"`,
        `"${lastLogText.replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `staff_ledger_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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

  // Staff Orders Bar Dashboard & Drill-down Bucket State (User Request)
  const [expandedStaffIds, setExpandedStaffIds] = useState<Set<string>>(new Set());
  const [selectedDetailOrder, setSelectedDetailOrder] = useState<Order | null>(null);

  // Assignment Modal for assigning / reassigning from dashboard
  const [assignModalOrder, setAssignModalOrder] = useState<Order | null>(null);
  const [targetStaffId, setTargetStaffId] = useState('');
  const [assignmentReason, setAssignmentReason] = useState('');

  // Live Work Note Modal
  const [workNoteModalOrder, setWorkNoteModalOrder] = useState<Order | null>(null);
  const [workNoteText, setWorkNoteText] = useState('');

  const toggleStaffExpand = (staffId: string) => {
    setExpandedStaffIds((prev) => {
      const next = new Set(prev);
      if (next.has(staffId)) {
        next.delete(staffId);
      } else {
        next.add(staffId);
      }
      return next;
    });
  };

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
    // Staff must state a reason; admin does not have to state reason
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
    const isOtherStaff = workNoteModalOrder.assignedStaffId && workNoteModalOrder.assignedStaffId !== currentUser?.staffId;
    const notePrefix = isOtherStaff ? `[Note by @${currentUser?.username || 'colleague'}] ` : '';
    addOrderWorkLog(workNoteModalOrder.id, 'Staff Progress Note', `${notePrefix}${workNoteText.trim()}`);
    setWorkNoteModalOrder(null);
    setWorkNoteText('');
  };

  const staffWorkloadData = useMemo(() => {
    return staffMembers.map((staff) => {
      const staffOrders = orders.filter((o) => o.assignedStaffId === staff.id);
      const pending = staffOrders.filter((o) => o.status === 'Pending').length;
      const confirmed = staffOrders.filter((o) => o.status === 'Confirmed').length;
      const shipped = staffOrders.filter((o) => o.status === 'Shipped').length;
      const delivered = staffOrders.filter((o) => o.status === 'Delivered').length;
      const cancelled = staffOrders.filter((o) => o.status === 'Cancelled' || o.status === 'Rejected').length;
      const totalAmount = staffOrders.reduce((sum, o) => sum + o.totalAmount, 0);

      return {
        staff,
        orders: staffOrders,
        total: staffOrders.length,
        pending,
        confirmed,
        shipped,
        delivered,
        cancelled,
        totalAmount,
      };
    });
  }, [staffMembers, orders]);

  const unassignedOrders = useMemo(() => {
    return orders.filter((o) => !o.assignedStaffId || o.assignedStaffId === 'unassigned');
  }, [orders]);

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

      {/* Live Admin Online / Offline Presence Status Banner (User Request) */}
      <div
        className={`p-4 sm:p-4.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          adminOnlineStatus?.isLoggedIn
            ? 'bg-gradient-to-r from-emerald-950 via-neutral-900 to-emerald-950/80 border-emerald-500/40 text-emerald-100 shadow-md'
            : 'bg-neutral-900 border-neutral-800 text-neutral-300'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
              adminOnlineStatus?.isLoggedIn
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40 shadow-xs'
                : 'bg-neutral-800 text-neutral-400 border-neutral-700'
            }`}
          >
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-serif font-bold text-sm text-white">
                Boutique Owner / Administrator Presence
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                  adminOnlineStatus?.isLoggedIn
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    adminOnlineStatus?.isLoggedIn
                      ? 'bg-emerald-400 animate-pulse'
                      : 'bg-neutral-500'
                  }`}
                ></span>
                <span>
                  {adminOnlineStatus?.isLoggedIn ? 'Admin Logged In' : 'Admin Logged Out'}
                </span>
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5 leading-relaxed">
              {adminOnlineStatus?.isLoggedIn
                ? `Owner is actively logged in to the boutique dashboard (session active since ${
                    adminOnlineStatus.lastLoginAt
                      ? new Date(adminOnlineStatus.lastLoginAt).toLocaleTimeString('en-IN')
                      : 'recently'
                  }). Staff order assignments & modifications are monitored live.`
                : `Owner is currently logged out / portal locked${
                    adminOnlineStatus?.lastLogoutAt
                      ? ` (last logged out: ${new Date(adminOnlineStatus.lastLogoutAt).toLocaleTimeString('en-IN')})`
                      : ''
                  }. Boutique staff members can independently handle assigned customer buckets.`}
            </p>
          </div>
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
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-1.5">
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

                    {/* Staff Logged In / Logged Out status (User Request) */}
                    {staff.isLoggedIn || (currentUser?.type === 'staff' && (currentUser.staffId === staff.id || currentUser.username === staff.username)) ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                        <span>Staff Logged In</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 border border-neutral-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-neutral-400"></span>
                        <span>Staff Logged Out</span>
                      </span>
                    )}
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      staff.isLocked
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-emerald-50 text-emerald-700'
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-serif text-lg font-bold text-neutral-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-amber-600" />
              <span>Staff Order Assignments Ledger</span>
            </h3>
            <p className="text-xs text-neutral-500">
              Current assignment distribution showing which boutique staff handles each client order
            </p>
          </div>

          {/* Google Sheets Sync & CSV Export Options (User Request) */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleSyncLedger}
              disabled={isSyncingLedger}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-950 text-xs font-semibold shadow-xs transition cursor-pointer"
              title="Sync staff order assignments ledger to Google Sheets with Admin Gmail"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
              <span>{isSyncingLedger ? 'Syncing Sheets...' : 'Sync with Google Sheets'}</span>
            </button>

            {(settings.ordersSpreadsheetUrl || settings.analyticsSpreadsheetUrl) && (
              <a
                href={settings.ordersSpreadsheetUrl || settings.analyticsSpreadsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-900 text-xs font-semibold shadow-xs transition"
                title="Open Master Google Sheets Ledger in new browser tab"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Open Sheets</span>
                <ExternalLink className="w-3 h-3 text-emerald-600" />
              </a>
            )}

            <button
              onClick={handleExportLedgerCsv}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-800 text-xs font-semibold shadow-xs transition cursor-pointer"
              title="Export staff assignments ledger to CSV file"
            >
              <Download className="w-3.5 h-3.5 text-neutral-700" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={() => setShowPerformanceBoard(!showPerformanceBoard)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs transition cursor-pointer border ${
                showPerformanceBoard
                  ? 'bg-amber-400 text-neutral-950 border-amber-300'
                  : 'bg-neutral-900 text-amber-300 border-neutral-700 hover:bg-neutral-800'
              }`}
              title="View multi-factor performance metrics: Fastest Order Closer, Fastest Assigner, and Fastest Dispute Resolver"
            >
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              <span>{showPerformanceBoard ? 'Hide Performance Board' : 'Staff Effort & Performance Board'}</span>
            </button>
          </div>
        </div>

        {/* Staff Performance & Appreciation Board (User Request) */}
        {showPerformanceBoard && (
          <StaffPerformanceBoard
            onClose={() => setShowPerformanceBoard(false)}
            onSelectStaffBucket={onNavigateToBucket}
            onExportCsv={handleExportLedgerCsv}
          />
        )}

        {/* Sync Success / Error Feedback Banner */}
        {ledgerSyncSuccess && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Synced <strong>{ledgerSyncSuccess.count}</strong> staff order assignments to your Master Google Sheet!
              </span>
            </div>
            {ledgerSyncSuccess.url && (
              <a
                href={ledgerSyncSuccess.url}
                target="_blank"
                rel="noreferrer"
                className="font-bold underline text-emerald-800 flex items-center gap-1 shrink-0"
              >
                <span>Open Google Sheet</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}

        {ledgerSyncError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-950 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{ledgerSyncError}</span>
          </div>
        )}

        {/* Summary Metric Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200">
            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">Total Boutique Orders</span>
            <p className="font-serif text-xl font-bold text-neutral-900 mt-0.5">{orders.length}</p>
          </div>
          <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-200">
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Claimed by Staff</span>
            <p className="font-serif text-xl font-bold text-emerald-700 mt-0.5">
              {orders.filter((o) => o.assignedStaffId && o.assignedStaffId !== 'unassigned').length}
            </p>
          </div>
          <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200">
            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">Unassigned Queue</span>
            <p className="font-serif text-xl font-bold text-amber-700 mt-0.5">{unassignedOrders.length}</p>
          </div>
          <div className="bg-purple-50/60 p-3 rounded-xl border border-purple-200">
            <span className="text-[10px] font-bold text-purple-800 uppercase tracking-wider block">Total Orders Value</span>
            <p className="font-serif text-xl font-bold text-purple-900 mt-0.5">
              {formatPrice(orders.reduce((sum, o) => sum + o.totalAmount, 0))}
            </p>
          </div>
        </div>

        {/* Bar Form Dashboard (User Request) */}
        <div className="space-y-4 pt-2">
          {/* Unassigned Intake Queue Bar */}
          <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/40 hover:bg-amber-50/70 transition space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-amber-500 text-neutral-950 flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                  <Clock className="w-4 h-4 text-neutral-950" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-serif font-bold text-sm text-neutral-900">
                      Unassigned Intake Queue
                    </h4>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900">
                      Awaiting Concierge Claim
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-600 mt-0.5">
                    Orders placed by customers on public storefront waiting for concierge staff to claim & close deal
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className="text-xs font-bold text-neutral-900 tabular-nums">
                  {unassignedOrders.length} {unassignedOrders.length === 1 ? 'order' : 'orders'} ({formatPrice(unassignedOrders.reduce((sum, o) => sum + o.totalAmount, 0))})
                </span>
                {onNavigateToBucket && (
                  <button
                    type="button"
                    onClick={() => onNavigateToBucket('unassigned')}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs transition flex items-center gap-1 shadow-2xs cursor-pointer"
                  >
                    <span>Open Unassigned Bucket</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => toggleStaffExpand('unassigned')}
                  className="px-2.5 py-1.5 rounded-xl border border-amber-300 hover:bg-amber-100 text-neutral-800 text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
                >
                  <span>{expandedStaffIds.has('unassigned') ? 'Hide Orders ▲' : 'View Orders ▼'}</span>
                </button>
              </div>
            </div>

            {/* Queue Bar */}
            <div className="w-full bg-neutral-200/80 h-3 rounded-full overflow-hidden">
              <div
                className="bg-amber-500 h-full rounded-full transition-all duration-300"
                style={{
                  width: `${orders.length > 0 ? (unassignedOrders.length / orders.length) * 100 : 0}%`,
                }}
              />
            </div>

            {/* Expanded Unassigned Orders */}
            {expandedStaffIds.has('unassigned') && (
              <div className="pt-3 border-t border-amber-200/80 space-y-2">
                {unassignedOrders.length === 0 ? (
                  <p className="text-xs text-neutral-500 italic py-2">No unassigned orders in the queue! All orders claimed.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {unassignedOrders.map((ord) => (
                      <div
                        key={ord.id}
                        onClick={() => setSelectedDetailOrder(ord)}
                        className="p-3 rounded-xl bg-white border border-amber-300 hover:border-amber-500 hover:shadow-md transition cursor-pointer flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-rose-950 text-xs">#{ord.orderNumber}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-900">{ord.status}</span>
                          </div>
                          <p className="text-xs font-bold text-neutral-900 mt-1">{ord.customer.name}</p>
                          <p className="text-[11px] text-neutral-500">{ord.items.length} saree(s) • {formatPrice(ord.totalAmount)}</p>
                        </div>
                        <span className="text-[11px] font-bold text-amber-800 hover:underline mt-2 flex items-center gap-1">
                          <span>Click to View & Claim</span>
                          <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Each Staff Member Workload Bar Card */}
          {staffWorkloadData.map(({ staff, orders: staffOrders, total, pending, confirmed, shipped, delivered, cancelled, totalAmount }) => {
            const isExpanded = expandedStaffIds.has(staff.id);
            const isMe = currentUser?.staffId === staff.id;

            return (
              <div
                key={staff.id}
                className={`p-4 rounded-2xl border transition-all space-y-3.5 ${
                  staff.isLocked
                    ? 'bg-neutral-50/70 border-neutral-300 opacity-90'
                    : isMe
                    ? 'bg-amber-50/20 border-amber-300 shadow-xs'
                    : 'bg-white border-neutral-200 hover:border-neutral-300 shadow-2xs'
                }`}
              >
                {/* Staff Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-600 via-rose-700 to-purple-800 text-white font-serif font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
                      {staff.name.charAt(0)}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-serif font-bold text-sm text-neutral-900 truncate">
                          {staff.name}
                        </h4>
                        <span className="text-[11px] font-mono text-neutral-500">
                          @{staff.username}
                        </span>
                        {isMe && (
                          <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-neutral-950">
                            You
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.2 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                            staff.role === 'manager'
                              ? 'bg-purple-100 text-purple-800'
                              : staff.role === 'fulfillment'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {staff.role}
                        </span>
                        {/* Staff Online Status Indicator */}
                        {staff.isLoggedIn || (currentUser?.type === 'staff' && (currentUser.staffId === staff.id || currentUser.username === staff.username)) ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                            <span>Online</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.2 rounded-full bg-neutral-100 text-neutral-500">
                            <span>Offline</span>
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-500 mt-0.5">
                        {staff.email ? `${staff.email}` : 'Google Auth'} {staff.phone ? `• ${staff.phone}` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Right Actions & Workload Counter */}
                  <div className="flex items-center gap-2 shrink-0 flex-wrap self-start sm:self-auto">
                    <div className="text-right mr-1">
                      <span className="text-xs font-bold text-neutral-950 block tabular-nums">
                        {total} {total === 1 ? 'Order' : 'Orders'} Assigned
                      </span>
                      <span className="text-[11px] text-neutral-500 font-semibold tabular-nums">
                        {formatPrice(totalAmount)}
                      </span>
                    </div>

                    {/* Move to Staff Bucket button (User Request) */}
                    {onNavigateToBucket && (
                      <button
                        type="button"
                        onClick={() => onNavigateToBucket(staff.id)}
                        className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs transition flex items-center gap-1 shadow-xs cursor-pointer"
                        title={`Move to ${staff.name}'s order bucket column`}
                      >
                        <Layers className="w-3.5 h-3.5 text-amber-400" />
                        <span>Move to Staff Bucket</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}

                    {/* Expand Inline Orders Button */}
                    <button
                      type="button"
                      onClick={() => toggleStaffExpand(staff.id)}
                      className="px-3 py-1.5 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-800 text-xs font-semibold transition flex items-center gap-1 shadow-2xs cursor-pointer"
                    >
                      <span>{isExpanded ? 'Hide Orders ▲' : `View Orders (${total}) ▼`}</span>
                    </button>
                  </div>
                </div>

                {/* The Workload Horizontal Bar (User Request: bar form dashboard) */}
                <div
                  onClick={() => toggleStaffExpand(staff.id)}
                  className="space-y-1.5 cursor-pointer group"
                  title="Click to expand/collapse orders"
                >
                  <div className="w-full bg-neutral-100 h-4 rounded-full overflow-hidden flex border border-neutral-200/80 p-0.5 shadow-inner">
                    {total === 0 ? (
                      <div className="w-full h-full rounded-full bg-neutral-200/60 flex items-center justify-center text-[9px] text-neutral-400 font-medium">
                        No orders currently assigned to this staff member
                      </div>
                    ) : (
                      <>
                        {pending > 0 && (
                          <div
                            style={{ width: `${(pending / total) * 100}%` }}
                            className="bg-amber-500 h-full rounded-l-full transition-all duration-300 relative group-hover:brightness-110"
                            title={`Pending: ${pending} orders`}
                          />
                        )}
                        {confirmed > 0 && (
                          <div
                            style={{ width: `${(confirmed / total) * 100}%` }}
                            className="bg-purple-500 h-full transition-all duration-300 relative group-hover:brightness-110"
                            title={`Confirmed: ${confirmed} orders`}
                          />
                        )}
                        {shipped > 0 && (
                          <div
                            style={{ width: `${(shipped / total) * 100}%` }}
                            className="bg-blue-500 h-full transition-all duration-300 relative group-hover:brightness-110"
                            title={`Shipped: ${shipped} orders`}
                          />
                        )}
                        {delivered > 0 && (
                          <div
                            style={{ width: `${(delivered / total) * 100}%` }}
                            className="bg-emerald-500 h-full rounded-r-full transition-all duration-300 relative group-hover:brightness-110"
                            title={`Delivered: ${delivered} orders`}
                          />
                        )}
                        {cancelled > 0 && (
                          <div
                            style={{ width: `${(cancelled / total) * 100}%` }}
                            className="bg-rose-500 h-full transition-all duration-300 relative group-hover:brightness-110"
                            title={`Cancelled/Rejected: ${cancelled} orders`}
                          />
                        )}
                      </>
                    )}
                  </div>

                  {/* Micro Legend & Stage Counters */}
                  <div className="flex items-center justify-between text-[11px] text-neutral-600 flex-wrap gap-2 pt-0.5">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="flex items-center gap-1 font-medium">
                        <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
                        <span>Pending ({pending})</span>
                      </span>
                      <span className="flex items-center gap-1 font-medium">
                        <span className="w-2 h-2 rounded-full bg-purple-500 inline-block"></span>
                        <span>Confirmed ({confirmed})</span>
                      </span>
                      <span className="flex items-center gap-1 font-medium">
                        <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
                        <span>Shipped ({shipped})</span>
                      </span>
                      <span className="flex items-center gap-1 font-medium">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                        <span>Delivered ({delivered})</span>
                      </span>
                      {cancelled > 0 && (
                        <span className="flex items-center gap-1 font-medium">
                          <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>
                          <span>Cancelled ({cancelled})</span>
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-neutral-400 italic">
                      Click bar to {isExpanded ? 'collapse' : 'view order details'}
                    </span>
                  </div>
                </div>

                {/* Inline Expandable Bucket Orders (User Request: when we click that respective staff bar, we can see that staff orders they were working and click to see details) */}
                {isExpanded && (
                  <div className="pt-3 border-t border-neutral-100 space-y-2.5 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <h5 className="font-serif font-bold text-xs text-neutral-900 flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-amber-600" />
                        <span>Orders Handled by {staff.name} ({staffOrders.length}):</span>
                      </h5>
                      <span className="text-[11px] text-neutral-500">
                        Click any order to view details, update stage, or add live work tracking logs
                      </span>
                    </div>

                    {staffOrders.length === 0 ? (
                      <p className="text-xs text-neutral-500 italic py-2">
                        No orders currently assigned to {staff.name}. You can assign orders from the intake queue.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {staffOrders.map((ord) => {
                          const lastLog = ord.assignmentHistory?.[ord.assignmentHistory.length - 1];
                          return (
                            <div
                              key={ord.id}
                              onClick={() => setSelectedDetailOrder(ord)}
                              className="p-3.5 rounded-xl bg-neutral-50 hover:bg-white border border-neutral-200 hover:border-amber-400 hover:shadow-md transition cursor-pointer flex flex-col justify-between space-y-2"
                            >
                              <div>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-mono font-bold text-rose-950 text-xs">#{ord.orderNumber}</span>
                                  <span
                                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                      ord.status === 'Delivered'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : ord.status === 'Shipped'
                                        ? 'bg-blue-100 text-blue-800'
                                        : ord.status === 'Confirmed'
                                        ? 'bg-purple-100 text-purple-800'
                                        : ord.status === 'Cancelled'
                                        ? 'bg-rose-100 text-rose-800'
                                        : 'bg-amber-100 text-amber-800'
                                    }`}
                                  >
                                    {ord.status}
                                  </span>
                                </div>
                                <h5 className="font-bold text-xs text-neutral-900 mt-1">{ord.customer.name}</h5>
                                <p className="text-[11px] text-neutral-500 font-mono">{ord.customer.phone}</p>
                                <p className="text-[11px] text-neutral-700 mt-0.5">
                                  {ord.items.length} saree(s) • <strong className="text-neutral-900">{formatPrice(ord.totalAmount)}</strong>
                                </p>
                                {lastLog && (
                                  <p className="text-[10px] text-neutral-500 mt-1.5 truncate border-t border-neutral-100 pt-1">
                                    Last action by <strong>{lastLog.staffName}</strong>: "{lastLog.action}"
                                  </p>
                                )}
                              </div>

                              <div className="pt-2 border-t border-neutral-200/60 flex items-center justify-between text-[11px] text-amber-800 font-bold">
                                <span>View Full Order Details →</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Detailed Order Modal (User Request: click staff order to open and see all details, stage, and work log) */}
      {selectedDetailOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 my-auto animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 bg-neutral-950 text-white flex items-center justify-between border-b border-neutral-800">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-bold text-rose-400 bg-rose-950/80 px-2.5 py-1 rounded-lg border border-rose-900/60">
                  #{selectedDetailOrder.orderNumber}
                </span>
                <div>
                  <h3 className="font-serif text-base font-bold text-white flex items-center gap-2">
                    <span>Order Details & Staff Handling</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        selectedDetailOrder.status === 'Delivered'
                          ? 'bg-emerald-500 text-neutral-950'
                          : selectedDetailOrder.status === 'Shipped'
                          ? 'bg-blue-500 text-neutral-950'
                          : selectedDetailOrder.status === 'Confirmed'
                          ? 'bg-purple-500 text-white'
                          : 'bg-amber-400 text-neutral-950'
                      }`}
                    >
                      {selectedDetailOrder.status}
                    </span>
                  </h3>
                  <p className="text-[11px] text-neutral-400">
                    Placed on {new Date(selectedDetailOrder.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetailOrder(null)}
                className="p-1 rounded-full text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto text-xs">
              {/* Handling Concierge Banner */}
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">Assigned Boutique Staff</span>
                  <p className="font-serif text-base font-bold text-neutral-950 mt-0.5">
                    {selectedDetailOrder.assignedStaffName || '⚠️ Unassigned (Intake Queue)'}
                  </p>
                  <p className="text-[11px] text-neutral-600">
                    All staff members can assist with this order; actions are recorded live with actor identity.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAssignModalOrder(selectedDetailOrder);
                      setTargetStaffId(selectedDetailOrder.assignedStaffId || (staffMembers[0]?.id || ''));
                      setAssignmentReason('');
                    }}
                    className="px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5 text-amber-400" />
                    <span>{selectedDetailOrder.assignedStaffId ? 'Reassign Order' : 'Assign to Staff'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setWorkNoteModalOrder(selectedDetailOrder);
                      setWorkNoteText('');
                    }}
                    className="px-3 py-2 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-800 font-semibold text-xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5 text-neutral-600" />
                    <span>Add Work Note</span>
                  </button>
                </div>
              </div>

              {/* Stage Switcher Buttons */}
              <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-2">
                <span className="font-bold text-neutral-700 text-xs block">Update Order Stage:</span>
                <div className="flex items-center gap-2 flex-wrap">
                  {(['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'] as OrderStatus[]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => handleStageChange(selectedDetailOrder, st)}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer ${
                        selectedDetailOrder.status === st
                          ? 'bg-neutral-950 text-white shadow-xs'
                          : 'bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-100'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Customer & Shipping Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-1.5">
                  <span className="font-bold text-neutral-700 uppercase tracking-wider text-[10px] block">Customer Information</span>
                  <p className="font-bold text-sm text-neutral-900">{selectedDetailOrder.customer.name}</p>
                  <p className="text-xs text-neutral-600 font-mono">{selectedDetailOrder.customer.phone}</p>
                  <p className="text-xs text-neutral-600">{selectedDetailOrder.customer.email}</p>
                  <p className="text-xs text-neutral-600 pt-1 leading-relaxed">
                    {selectedDetailOrder.customer.address}, {selectedDetailOrder.customer.city}, {selectedDetailOrder.customer.state} - {selectedDetailOrder.customer.pincode}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-1.5">
                  <span className="font-bold text-neutral-700 uppercase tracking-wider text-[10px] block">Payment & Delivery</span>
                  <p className="text-xs text-neutral-600">
                    Payment Method: <strong className="text-neutral-900 font-semibold">{selectedDetailOrder.checkoutMethod}</strong>
                  </p>
                  <p className="text-xs text-neutral-600">
                    UPI Reference / UTR:{' '}
                    <strong className="text-neutral-900 font-mono">{selectedDetailOrder.upiTransactionId || 'Verification Pending'}</strong>
                  </p>
                  {selectedDetailOrder.shippingDetails && (
                    <div className="pt-1 text-xs text-neutral-700">
                      <p>Courier: <strong>{selectedDetailOrder.shippingDetails.courierName}</strong></p>
                      <p>Tracking: <strong className="font-mono">{selectedDetailOrder.shippingDetails.trackingNumber}</strong></p>
                    </div>
                  )}
                  <p className="pt-1 text-sm font-bold text-neutral-950">
                    Total Amount: {formatPrice(selectedDetailOrder.totalAmount)}
                  </p>
                </div>
              </div>

              {/* Saree Items List */}
              <div className="p-4 rounded-2xl bg-white border border-neutral-200 space-y-2">
                <span className="font-bold text-neutral-700 text-xs block">
                  Ordered Sarees ({selectedDetailOrder.items.length}):
                </span>
                <div className="divide-y divide-neutral-100">
                  {selectedDetailOrder.items.map((it, idx) => (
                    <div key={idx} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {it.product.images?.[0] && (
                          <img
                            src={it.product.images[0]}
                            alt={it.product.title}
                            className="w-11 h-11 rounded-lg object-cover border border-neutral-200 shrink-0"
                          />
                        )}
                        <div>
                          <p className="font-bold text-neutral-900">{it.product.title}</p>
                          <p className="text-[11px] text-neutral-500 font-mono">
                            {it.product.productCode} • {it.product.fabric} - {it.product.color}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-neutral-900 tabular-nums">
                          {formatPrice(it.product.price * it.quantity)}
                        </span>
                        <span className="text-[11px] text-neutral-500 block">
                          Qty: {it.quantity} × {formatPrice(it.product.price)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Live Work & Assignment Log (User Request: recorded on the order "Live Work & Assignment Log:") */}
              <div className="p-4 rounded-2xl bg-neutral-900 text-white space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-serif font-bold text-xs sm:text-sm text-amber-300 flex items-center gap-1.5">
                    <History className="w-4 h-4 text-amber-400" />
                    <span>Live Work & Assignment Log:</span>
                  </h4>
                  <span className="text-[10px] text-neutral-400">
                    Timestamped audit trail of all staff & admin changes
                  </span>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {(!selectedDetailOrder.assignmentHistory || selectedDetailOrder.assignmentHistory.length === 0) ? (
                    <p className="text-xs text-neutral-400 italic">No work log recorded yet.</p>
                  ) : (
                    selectedDetailOrder.assignmentHistory.map((log) => (
                      <div
                        key={log.id}
                        className="p-2.5 rounded-xl bg-neutral-800/80 border border-neutral-700/80 text-[11px] space-y-0.5"
                      >
                        <div className="flex items-center justify-between text-neutral-400 text-[10px]">
                          <span className="font-bold text-amber-300">{log.staffName}</span>
                          <span className="font-mono">
                            {new Date(log.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                          </span>
                        </div>
                        <p className="font-semibold text-white">{log.action}</p>
                        {log.note && <p className="text-neutral-300 italic">{log.note}</p>}
                        {log.assignedBy && (
                          <p className="text-[10px] text-neutral-400">By: {log.assignedBy}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedDetailOrder(null)}
                className="px-5 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs transition cursor-pointer"
              >
                Close Order Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assignment Modal (Staff must state a reason; Admin does not have to state reason) */}
      {assignModalOrder && (
        <div className="fixed inset-0 z-60 overflow-y-auto bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 my-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 bg-neutral-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-serif text-base font-bold text-white flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-amber-400" />
                  <span>Assign Order Staff</span>
                </h3>
                <p className="text-[11px] text-neutral-400 font-mono">
                  Order #{assignModalOrder.orderNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAssignModalOrder(null)}
                className="p-1 rounded-full text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-neutral-800 mb-1.5">
                  Select Assignee Staff Member *
                </label>
                <select
                  value={targetStaffId}
                  onChange={(e) => setTargetStaffId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900 font-medium"
                >
                  <option value="">-- Choose staff specialist --</option>
                  <option value="admin">Store Owner (Admin)</option>
                  {staffMembers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (@{s.username}) - {s.role}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-neutral-800">
                    Assignment Reason {isAdmin ? '(Optional for Admin)' : '(Mandatory for Staff) *'}
                  </label>
                  {!isAdmin && (
                    <span className="text-[10px] text-rose-600 font-bold">Reason Required</span>
                  )}
                </div>
                <textarea
                  rows={2}
                  value={assignmentReason}
                  onChange={(e) => setAssignmentReason(e.target.value)}
                  placeholder={
                    isAdmin
                      ? 'e.g. Standard intake allocation, specialized weaver follow-up...'
                      : 'e.g. Claiming client inquiry, language preference, shift handover...'
                  }
                  className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900 resize-none"
                />
                {!isAdmin && (
                  <p className="text-[10px] text-neutral-500 mt-1">
                    Staff members must state an assignment reason to maintain audit trail transparency.
                  </p>
                )}
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAssignModalOrder(null)}
                  className="px-4 py-2 rounded-xl border border-neutral-300 text-neutral-700 font-semibold hover:bg-neutral-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAssignment}
                  className="px-5 py-2 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white font-bold transition shadow-xs flex items-center gap-1.5"
                >
                  <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span>Confirm Assignment</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Work Note Modal */}
      {workNoteModalOrder && (
        <div className="fixed inset-0 z-60 overflow-y-auto bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100 my-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 bg-neutral-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-serif text-base font-bold text-white flex items-center gap-2">
                  <Edit className="w-4 h-4 text-amber-400" />
                  <span>Add Live Work Note</span>
                </h3>
                <p className="text-[11px] text-neutral-400 font-mono">
                  Order #{workNoteModalOrder.orderNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWorkNoteModalOrder(null)}
                className="p-1 rounded-full text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-neutral-800 mb-1">
                  Work Progress Note *
                </label>
                <textarea
                  rows={3}
                  value={workNoteText}
                  onChange={(e) => setWorkNoteText(e.target.value)}
                  placeholder="e.g. Saree zari verified at Salem loom, packaged in royal wooden gift box..."
                  className="w-full p-2.5 rounded-xl border border-neutral-300 text-neutral-900 resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setWorkNoteModalOrder(null)}
                  className="px-4 py-2 rounded-xl border border-neutral-300 text-neutral-700 font-semibold hover:bg-neutral-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddWorkNote}
                  disabled={!workNoteText.trim()}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-neutral-950 font-bold transition shadow-xs"
                >
                  Save to Work Log
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
};
