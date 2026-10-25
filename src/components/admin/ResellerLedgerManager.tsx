import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { ResellerAccessRequest, ResellerUser } from '../../types/store';
import { formatPrice } from '../../utils/upi';
import {
  Building,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Filter,
  Plus,
  Mail,
  Phone,
  MapPin,
  ShieldCheck,
  ShieldAlert,
  Percent,
  Check,
  X,
  ExternalLink,
  Download,
  AlertCircle,
  Store,
  RefreshCw,
  ShoppingBag,
  Trash2,
  Calendar,
  Lock,
  Unlock,
  AlertTriangle,
} from 'lucide-react';

export const ResellerLedgerManager: React.FC = () => {
  const {
    resellers,
    resellerRequests,
    approveResellerRequest,
    declineResellerRequest,
    createResellerManual,
    updateResellerStatus,
    toggleResellerLock,
    deleteReseller,
    resellerOrders,
    settings,
  } = useStore();

  const [activeLedgerTab, setActiveLedgerTab] = useState<'requests' | 'active_resellers' | 'history'>('requests');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'approved' | 'declined'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Lock & Remove Reseller States
  const [resellerToRemove, setResellerToRemove] = useState<ResellerUser | null>(null);
  const [lockingResellerId, setLockingResellerId] = useState<string | null>(null);

  // Manual Add Reseller Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newContactName, setNewContactName] = useState('');
  const [newBusinessName, setNewBusinessName] = useState('');
  const [newWhatsapp, setNewWhatsapp] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newGst, setNewGst] = useState('');
  const [newMarginPercent, setNewMarginPercent] = useState<number>(20);
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);
  const [addModalError, setAddModalError] = useState('');

  // Approval Modal with custom margin
  const [approvingRequest, setApprovingRequest] = useState<ResellerAccessRequest | null>(null);
  const [approvalMargin, setApprovalMargin] = useState<number>(20);

  // Decline prompt modal
  const [decliningRequest, setDecliningRequest] = useState<ResellerAccessRequest | null>(null);
  const [declineReason, setDeclineReason] = useState('');

  // Pending requests count
  const pendingRequests = useMemo(() => {
    return (resellerRequests || []).filter((r) => r.status === 'pending');
  }, [resellerRequests]);

  const historyRequests = useMemo(() => {
    return (resellerRequests || []).filter((r) => r.status !== 'pending');
  }, [resellerRequests]);

  // Filtered pending requests
  const filteredRequests = useMemo(() => {
    return pendingRequests.filter((req) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        req.email?.toLowerCase().includes(q) ||
        req.contactName?.toLowerCase().includes(q) ||
        req.businessName?.toLowerCase().includes(q) ||
        req.whatsappNumber?.includes(q) ||
        req.city?.toLowerCase().includes(q)
      );
    });
  }, [pendingRequests, searchQuery]);

  // Filtered active approved resellers
  const filteredResellers = useMemo(() => {
    return (resellers || []).filter((reseller) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        reseller.email?.toLowerCase().includes(q) ||
        reseller.name?.toLowerCase().includes(q) ||
        reseller.businessName?.toLowerCase().includes(q) ||
        reseller.whatsappNumber?.includes(q) ||
        reseller.city?.toLowerCase().includes(q)
      );
    });
  }, [resellers, searchQuery]);

  // Filtered Request History
  const filteredHistoryRequests = useMemo(() => {
    return historyRequests.filter((req) => {
      if (historyFilter !== 'all' && req.status !== historyFilter) return false;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        req.email?.toLowerCase().includes(q) ||
        req.contactName?.toLowerCase().includes(q) ||
        req.businessName?.toLowerCase().includes(q) ||
        req.whatsappNumber?.includes(q) ||
        req.city?.toLowerCase().includes(q) ||
        req.rejectionReason?.toLowerCase().includes(q) ||
        req.declineReason?.toLowerCase().includes(q) ||
        req.reviewedBy?.toLowerCase().includes(q)
      );
    });
  }, [historyRequests, searchQuery, historyFilter]);

  // Aggregate stats
  const totalApprovedPartners = (resellers || []).length;
  const activePartnersCount = (resellers || []).filter((r) => r.status === 'active' && !r.isLocked).length;
  const lockedPartnersCount = (resellers || []).filter((r) => r.isLocked || r.status === 'suspended' || r.status === 'locked').length;
  const totalOrdersCount = (resellerOrders || []).length;
  const totalVolumeAmount = (resellerOrders || []).reduce((sum, o) => sum + (o.totalAmount || 0), 0);

  const showFeedback = (msg: string) => {
    setActionSuccessMsg(msg);
    setTimeout(() => setActionSuccessMsg(null), 4000);
  };

  const handleToggleResellerLock = async (reseller: ResellerUser) => {
    setLockingResellerId(reseller.id);
    try {
      const isCurrentlyLocked = reseller.isLocked || reseller.status === 'suspended' || reseller.status === 'locked';
      const targetState = !isCurrentlyLocked;
      const res = await toggleResellerLock(reseller.id, targetState);
      if (res.success) {
        showFeedback(
          targetState
            ? `🔒 Account Locked: ${reseller.businessName || reseller.name} (${reseller.email}) is now locked and blocked from logging into the Reseller Portal.`
            : `🔓 Account Unlocked: ${reseller.businessName || reseller.name} (${reseller.email}) has been unlocked. Reseller portal access restored.`
        );
      } else {
        alert(res.error || 'Failed to update reseller lock status.');
      }
    } catch (err: any) {
      alert(err?.message || 'Error toggling reseller lock.');
    } finally {
      setLockingResellerId(null);
    }
  };

  const handleConfirmRemoveReseller = async () => {
    if (!resellerToRemove) return;
    setProcessingId(resellerToRemove.id);
    try {
      const res = await deleteReseller(resellerToRemove.id);
      if (res.success) {
        showFeedback(
          `🗑️ Reseller ${resellerToRemove.businessName || resellerToRemove.name} (${resellerToRemove.email}) has been permanently removed and blocked from logging in.`
        );
        setResellerToRemove(null);
      } else {
        alert(res.error || 'Failed to remove reseller.');
      }
    } catch (err: any) {
      alert(err?.message || 'Error removing reseller.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleConfirmApproval = async () => {
    if (!approvingRequest) return;
    setProcessingId(approvingRequest.id);
    try {
      const res = await approveResellerRequest(approvingRequest.id, {
        wholesaleDiscountPercent: approvalMargin || 20,
      });
      if (res.success) {
        showFeedback(`Access granted for ${approvingRequest.email}. Added to 'reseller' collection.`);
        setApprovingRequest(null);
      } else {
        alert(res.error || 'Failed to approve reseller access.');
      }
    } catch (err: any) {
      alert(err?.message || 'Error occurred during approval.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleConfirmDecline = async () => {
    if (!decliningRequest) return;
    setProcessingId(decliningRequest.id);
    try {
      const res = await declineResellerRequest(decliningRequest.id, declineReason);
      if (res.success) {
        showFeedback(`Access request for ${decliningRequest.email} was declined.`);
        setDecliningRequest(null);
        setDeclineReason('');
      } else {
        alert(res.error || 'Failed to decline request.');
      }
    } catch (err: any) {
      alert(err?.message || 'Error declining request.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleCreateManualPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddModalError('');
    if (!newEmail.trim() || !newEmail.includes('@')) {
      setAddModalError('Valid partner email is required.');
      return;
    }
    if (!newContactName.trim()) {
      setAddModalError('Contact person name is required.');
      return;
    }
    const cleanPhone = newWhatsapp.replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length < 10) {
      setAddModalError('10-digit WhatsApp number is required.');
      return;
    }

    setIsSubmittingNew(true);
    try {
      const res = await createResellerManual({
        email: newEmail.trim().toLowerCase(),
        name: newContactName.trim(),
        businessName: newBusinessName.trim() || 'Independent Boutique',
        phone: cleanPhone,
        whatsappNumber: cleanPhone,
        city: newCity.trim() || undefined,
        gstOrPan: newGst.trim() || undefined,
        wholesaleDiscountPercent: Number(newMarginPercent) || 20,
        status: 'active',
      });

      if (res.success) {
        showFeedback(`Partner ${newEmail} created and added to 'reseller' collection.`);
        setIsAddModalOpen(false);
        setNewEmail('');
        setNewContactName('');
        setNewBusinessName('');
        setNewWhatsapp('');
        setNewCity('');
        setNewGst('');
        setNewMarginPercent(20);
      } else {
        setAddModalError(res.error || 'Failed to create partner.');
      }
    } catch (err: any) {
      setAddModalError(err?.message || 'Error creating partner.');
    } finally {
      setIsSubmittingNew(false);
    }
  };

  const handleExportResellersCsv = () => {
    if (resellers.length === 0) {
      alert('No reseller records to export.');
      return;
    }
    const headers = ['Email', 'Business Name', 'Contact Name', 'WhatsApp', 'City', 'GST/PAN', 'Discount %', 'Status', 'Approved At'];
    const rows = resellers.map((r) => [
      r.email,
      `"${r.businessName || ''}"`,
      `"${r.name || ''}"`,
      r.whatsappNumber,
      `"${r.city || ''}"`,
      `"${r.gstOrPan || ''}"`,
      r.wholesaleDiscountPercent || 20,
      r.status,
      r.approvedAt || r.createdAt,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `neydhal_reseller_ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner & Title Bar */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="w-10 h-10 rounded-xl bg-purple-900 text-white flex items-center justify-center shadow-sm">
              <Building className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-serif font-bold text-neutral-900 tracking-tight">
                  Reseller Ledger
                </h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-900 border border-purple-200">
                  Authentication & Partner Directory
                </span>
              </div>
              <p className="text-xs text-neutral-500">
                Review reseller access requests, approve enterprise accounts, and manage the official B2B partner ledger.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap w-full md:w-auto">
          <button
            type="button"
            onClick={handleExportResellersCsv}
            className="px-3.5 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer border border-neutral-200"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-purple-900 hover:bg-purple-800 text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Reseller Partner</span>
          </button>
        </div>
      </div>

      {/* Success Notification Alert */}
      {actionSuccessMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 flex items-center gap-2 text-xs sm:text-sm font-semibold animate-in slide-in-from-top">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-neutral-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending Requests</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-serif font-bold text-neutral-900">
            {pendingRequests.length}
          </p>
          <p className="text-[11px] text-neutral-500">Awaiting admin authentication</p>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-neutral-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Approved Partners</span>
            <Users className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-serif font-bold text-purple-900">
            {totalApprovedPartners}
          </p>
          <p className="text-[11px] text-neutral-500">
            {lockedPartnersCount > 0
              ? `${activePartnersCount} active • ${lockedPartnersCount} locked`
              : `${activePartnersCount} active in 'reseller' collection`}
          </p>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-neutral-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Reseller Orders</span>
            <ShoppingBag className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-serif font-bold text-emerald-900">
            {totalOrdersCount}
          </p>
          <p className="text-[11px] text-neutral-500">B2B dropship & wholesale</p>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-neutral-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Sales Volume</span>
            <Percent className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-serif font-bold text-amber-900">
            {formatPrice(totalVolumeAmount)}
          </p>
          <p className="text-[11px] text-neutral-500">Gross enterprise turnover</p>
        </div>
      </div>

      {/* Tabs and Search Controls (Fixed layout so Request History never truncates) */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs p-3 sm:p-4 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
        {/* Tab switchers with horizontal scroll resilience */}
        <div className="flex items-center gap-1.5 bg-neutral-100 p-1.5 rounded-xl overflow-x-auto scrollbar-none max-w-full shrink-0">
          <button
            type="button"
            onClick={() => setActiveLedgerTab('requests')}
            className={`whitespace-nowrap px-3.5 sm:px-4 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 shrink-0 cursor-pointer ${
              activeLedgerTab === 'requests'
                ? 'bg-purple-900 text-white shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>Pending Requests</span>
            {pendingRequests.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber-500 text-neutral-950 text-[10px] flex items-center justify-center font-bold shrink-0">
                {pendingRequests.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveLedgerTab('active_resellers')}
            className={`whitespace-nowrap px-3.5 sm:px-4 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 shrink-0 cursor-pointer ${
              activeLedgerTab === 'active_resellers'
                ? 'bg-purple-900 text-white shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span>Approved Resellers ({totalApprovedPartners})</span>
            {lockedPartnersCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[9px] font-bold">
                {lockedPartnersCount} locked
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveLedgerTab('history')}
            className={`whitespace-nowrap px-3.5 sm:px-4 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 shrink-0 cursor-pointer ${
              activeLedgerTab === 'history'
                ? 'bg-purple-900 text-white shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span>Request History</span>
            <span className="px-1.5 py-0.5 rounded-full bg-neutral-200 text-neutral-700 text-[10px] font-bold shrink-0">
              {historyRequests.length}
            </span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative w-full xl:w-80 shrink-0">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search email, business, phone..."
            className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-900/20 focus:border-purple-900 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 p-0.5 rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Tab Content */}
      {activeLedgerTab === 'requests' && (
        <div className="space-y-4">
          {filteredRequests.length === 0 ? (
            <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center space-y-3">
              <span className="w-12 h-12 rounded-2xl bg-neutral-100 text-neutral-400 flex items-center justify-center mx-auto">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              </span>
              <h3 className="font-serif text-lg font-bold text-neutral-900">
                All Reseller Requests Processed
              </h3>
              <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                No new reseller access requests are pending. When someone submits the "Request Reseller Access" form, their email and enterprise details will appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRequests.map((req) => (
                <div
                  key={req.id}
                  className="bg-white rounded-2xl border border-neutral-200 hover:border-purple-300 p-5 shadow-xs hover:shadow-md transition space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>Awaiting Authorization</span>
                      </span>
                      <span className="text-[10px] text-neutral-400">
                        {new Date(req.requestedAt || req.createdAt || Date.now()).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>

                    <div>
                      {/* Email ID: Prominently displayed as requested so admin can review and add */}
                      <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-100 mb-2">
                        <span className="text-[10px] font-bold text-purple-900 uppercase tracking-wider block">
                          Applicant Email ID
                        </span>
                        <p className="text-sm font-bold text-neutral-900 select-all font-mono truncate">
                          {req.email}
                        </p>
                      </div>

                      <h4 className="font-serif text-base font-bold text-neutral-900 truncate">
                        {req.businessName || 'Independent Retailer'}
                      </h4>
                      <p className="text-xs text-neutral-600 font-medium">
                        Contact: <strong>{req.contactName}</strong>
                      </p>
                    </div>

                    <div className="space-y-1.5 text-xs text-neutral-600 pt-1 border-t border-neutral-100">
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-400 flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5" />
                          <span>WhatsApp:</span>
                        </span>
                        <a
                          href={`https://wa.me/91${req.whatsappNumber.replace(/\D/g, '').slice(-10)}?text=Hello%20${encodeURIComponent(req.contactName)},%20Neydhal%20Clothing%20received%20your%20reseller%20access%20request.`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-purple-900 hover:text-purple-700 font-bold flex items-center gap-1"
                        >
                          <span>{req.whatsappNumber}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>

                      {req.city && (
                        <div className="flex items-center justify-between">
                          <span className="text-neutral-400 flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5" />
                            <span>City:</span>
                          </span>
                          <span className="font-medium text-neutral-800">{req.city}</span>
                        </div>
                      )}

                      {req.gstOrPan && (
                        <div className="flex items-center justify-between">
                          <span className="text-neutral-400 flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>GST/PAN:</span>
                          </span>
                          <span className="font-mono text-[11px] font-bold text-neutral-800 uppercase">
                            {req.gstOrPan}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Accept / Decline Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-3 border-t border-neutral-100">
                    <button
                      type="button"
                      disabled={processingId === req.id}
                      onClick={() => {
                        setDecliningRequest(req);
                        setDeclineReason('');
                      }}
                      className="py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer border border-rose-200"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Decline</span>
                    </button>

                    <button
                      type="button"
                      disabled={processingId === req.id}
                      onClick={() => {
                        setApprovingRequest(req);
                        setApprovalMargin(20);
                      }}
                      className="py-2 px-3 rounded-xl bg-purple-900 hover:bg-purple-800 text-white text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer shadow-xs active:scale-98"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Accept Access</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Approved Reseller Directory Tab */}
      {activeLedgerTab === 'active_resellers' && (
        <div className="space-y-4">
          {filteredResellers.length === 0 ? (
            <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center space-y-3">
              <span className="w-12 h-12 rounded-2xl bg-neutral-100 text-neutral-400 flex items-center justify-center mx-auto">
                <Users className="w-6 h-6 text-purple-900" />
              </span>
              <h3 className="font-serif text-lg font-bold text-neutral-900">
                {searchQuery ? 'No Matching Resellers Found' : 'No Approved Resellers Found'}
              </h3>
              <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                {searchQuery
                  ? `No approved reseller records match "${searchQuery}". Try searching by another name, email, or phone number.`
                  : "When you approve access requests or manually add partners, they are saved in the separate 'reseller' database collection and listed here."}
              </p>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold"
                >
                  Clear Search
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[980px]">
                  <thead className="bg-neutral-50 text-neutral-500 font-semibold uppercase tracking-wider border-b border-neutral-200">
                    <tr>
                      <th className="py-3 px-4">Partner & Business</th>
                      <th className="py-3 px-4">Email ID (Auth ID)</th>
                      <th className="py-3 px-4">WhatsApp / Contact</th>
                      <th className="py-3 px-4">Wholesale Margin</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Login Access (Lock / Unlock)</th>
                      <th className="py-3 px-4">Approved At</th>
                      <th className="py-3 px-4 text-right">Remove Reseller</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {filteredResellers.map((r) => {
                      const isLocked = r.isLocked || r.status === 'suspended' || r.status === 'locked';
                      return (
                        <tr
                          key={r.id}
                          className={`transition ${
                            isLocked ? 'bg-amber-50/40 hover:bg-amber-50/70' : 'hover:bg-neutral-50/80'
                          }`}
                        >
                          {/* Partner & Business */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <span
                                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                  isLocked
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-purple-100 text-purple-900 font-bold'
                                }`}
                              >
                                {isLocked ? (
                                  <Lock className="w-4 h-4 text-amber-800" />
                                ) : (
                                  <Building className="w-4 h-4 text-purple-900" />
                                )}
                              </span>
                              <div>
                                <p className="font-bold text-neutral-900 flex items-center gap-1.5">
                                  <span>{r.businessName || 'B2B Enterprise'}</span>
                                  {isLocked && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-100 text-rose-700 uppercase tracking-wider">
                                      Locked
                                    </span>
                                  )}
                                </p>
                                <p className="text-[11px] text-neutral-500">{r.name}</p>
                              </div>
                            </div>
                          </td>

                          {/* Email ID (Auth ID) */}
                          <td className="py-3.5 px-4 font-mono font-medium text-neutral-800">
                            <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-900 border border-purple-100 font-bold inline-block">
                              {r.email}
                            </span>
                          </td>

                          {/* WhatsApp / Contact */}
                          <td className="py-3.5 px-4">
                            <a
                              href={`https://wa.me/91${r.whatsappNumber.replace(/\D/g, '').slice(-10)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="font-mono text-purple-900 hover:underline flex items-center gap-1 font-bold"
                            >
                              <span>{r.whatsappNumber}</span>
                              <ExternalLink className="w-3 h-3 text-neutral-400" />
                            </a>
                            {r.city && <p className="text-[10px] text-neutral-500">{r.city}</p>}
                          </td>

                          {/* Wholesale Margin */}
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-neutral-900">
                              {r.wholesaleDiscountPercent || 20}%
                            </span>
                            <span className="text-[10px] text-neutral-400 block">flat discount</span>
                          </td>

                          {/* Status Badge */}
                          <td className="py-3.5 px-4">
                            {isLocked ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200">
                                <Lock className="w-3 h-3 text-rose-700" />
                                <span>Locked</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span>Active</span>
                              </span>
                            )}
                          </td>

                          {/* DEDICATED COLUMN: LOGIN ACCESS (LOCK / UNLOCK) */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {isLocked ? (
                              <div>
                                <button
                                  type="button"
                                  disabled={lockingResellerId === r.id}
                                  onClick={() => handleToggleResellerLock(r)}
                                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                                  title="Restore login access for this reseller partner"
                                >
                                  <Unlock className="w-3.5 h-3.5" />
                                  <span>{lockingResellerId === r.id ? 'Unlocking...' : 'Unlock Account'}</span>
                                </button>
                                <p className="text-[10px] text-rose-600 font-medium mt-0.5">
                                  Login blocked by admin
                                </p>
                              </div>
                            ) : (
                              <div>
                                <button
                                  type="button"
                                  disabled={lockingResellerId === r.id}
                                  onClick={() => handleToggleResellerLock(r)}
                                  className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 active:scale-95 text-amber-900 border border-amber-300 text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                                  title="Prevent this reseller partner from logging into the Reseller Portal"
                                >
                                  <Lock className="w-3.5 h-3.5 text-amber-700" />
                                  <span>{lockingResellerId === r.id ? 'Locking...' : 'Lock Account'}</span>
                                </button>
                                <p className="text-[10px] text-neutral-400 mt-0.5">
                                  Can log in & order
                                </p>
                              </div>
                            )}
                          </td>

                          {/* Approved At */}
                          <td className="py-3.5 px-4 text-neutral-500 text-[11px] whitespace-nowrap">
                            {r.approvedAt
                              ? new Date(r.approvedAt).toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })
                              : 'Direct'}
                          </td>

                          {/* DEDICATED COLUMN: REMOVE RESELLER */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setResellerToRemove(r)}
                              className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 border border-rose-200 text-xs font-bold transition inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                              title={`Remove ${r.businessName || r.name} from reseller database`}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                              <span>Remove</span>
                            </button>
                            <p className="text-[10px] text-neutral-400 mt-0.5">
                              Revoke & delete
                            </p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Request History Tab */}
      {activeLedgerTab === 'history' && (
        <div className="space-y-4">
          {/* Sub-filter bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-2xl border border-neutral-200 p-3 sm:p-4 shadow-xs">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
              <button
                type="button"
                onClick={() => setHistoryFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                  historyFilter === 'all'
                    ? 'bg-purple-900 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:text-neutral-900'
                }`}
              >
                All History ({historyRequests.length})
              </button>
              <button
                type="button"
                onClick={() => setHistoryFilter('approved')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                  historyFilter === 'approved'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Approved ({historyRequests.filter((r) => r.status === 'approved').length})
              </button>
              <button
                type="button"
                onClick={() => setHistoryFilter('declined')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                  historyFilter === 'declined'
                    ? 'bg-rose-700 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Declined ({historyRequests.filter((r) => r.status === 'declined').length})
              </button>
            </div>

            <p className="text-xs text-neutral-500">
              Showing <span className="font-bold text-neutral-900">{filteredHistoryRequests.length}</span> recorded decisions
            </p>
          </div>

          {filteredHistoryRequests.length === 0 ? (
            <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center space-y-3">
              <span className="w-12 h-12 rounded-2xl bg-neutral-100 text-neutral-400 flex items-center justify-center mx-auto">
                <Calendar className="w-6 h-6 text-neutral-400" />
              </span>
              <h3 className="font-serif text-lg font-bold text-neutral-900">
                {searchQuery ? 'No Matching Decision Logs' : 'No Request History Yet'}
              </h3>
              <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                {searchQuery
                  ? `No historical requests match "${searchQuery}". Clear your search query to view all decisions.`
                  : 'Whenever you accept or decline an applicant from the Pending Requests queue, their record and admin audit note will appear here.'}
              </p>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold"
                >
                  Clear Search
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[850px]">
                  <thead className="bg-neutral-50 text-neutral-500 font-semibold uppercase tracking-wider border-b border-neutral-200">
                    <tr>
                      <th className="py-3 px-4">Applicant & Business</th>
                      <th className="py-3 px-4">Applicant Email</th>
                      <th className="py-3 px-4">WhatsApp Contact</th>
                      <th className="py-3 px-4">Decision Status</th>
                      <th className="py-3 px-4">Decision Date</th>
                      <th className="py-3 px-4">Notes / Margin</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {filteredHistoryRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-neutral-50/80 transition">
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-neutral-900">{req.businessName || 'Independent Reseller'}</p>
                          <p className="text-[11px] text-neutral-500">{req.contactName}</p>
                          {req.city && <p className="text-[10px] text-neutral-400">{req.city}</p>}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-neutral-800">
                          <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-900 border border-purple-100 font-bold inline-block">
                            {req.email}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <a
                            href={`https://wa.me/91${req.whatsappNumber.replace(/\D/g, '').slice(-10)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-mono text-neutral-700 hover:text-purple-900 hover:underline flex items-center gap-1 font-semibold"
                          >
                            <span>{req.whatsappNumber}</span>
                            <ExternalLink className="w-3 h-3 text-neutral-400" />
                          </a>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              req.status === 'approved'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-rose-100 text-rose-800 border border-rose-200'
                            }`}
                          >
                            {req.status === 'approved' ? (
                              <CheckCircle className="w-3 h-3 text-emerald-700" />
                            ) : (
                              <XCircle className="w-3 h-3 text-rose-700" />
                            )}
                            <span>{req.status}</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-neutral-500 text-[11px] whitespace-nowrap">
                          {req.reviewedAt
                            ? new Date(req.reviewedAt).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })
                            : '-'}
                        </td>
                        <td className="py-3.5 px-4 text-[11px]">
                          {req.status === 'approved' ? (
                            <span className="text-emerald-700 font-medium">
                              Added with {req.wholesaleDiscountPercent || 20}% margin
                            </span>
                          ) : (
                            <span className="text-neutral-600">
                              {req.declineReason || req.rejectionReason || 'Declined by boutique admin'}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          {req.status === 'declined' ? (
                            <button
                              type="button"
                              onClick={() => {
                                setApprovingRequest(req);
                                setApprovalMargin(20);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 text-[11px] font-bold transition cursor-pointer"
                            >
                              Grant Access Now
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveLedgerTab('active_resellers');
                                setSearchQuery(req.email);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-[11px] font-medium transition cursor-pointer"
                            >
                              View in Ledger
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal: Confirm Approval */}
      {approvingRequest && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-neutral-200 space-y-4 animate-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5" />
                </span>
                <h3 className="font-serif text-lg font-bold text-neutral-900">
                  Accept Reseller Access
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setApprovingRequest(null)}
                className="text-neutral-400 hover:text-neutral-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-neutral-600 leading-relaxed">
              You are approving <strong>{approvingRequest.contactName}</strong> (
              <span className="font-mono text-purple-900 font-bold">{approvingRequest.email}</span>
              ). This partner will be stored in the separate Firestore collection named{' '}
              <code className="bg-neutral-100 px-1 py-0.5 rounded font-mono text-purple-900">reseller</code> and granted access to wholesale pricing.
            </p>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1">
                Wholesale Discount Margin (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={5}
                  max={50}
                  value={approvalMargin}
                  onChange={(e) => setApprovalMargin(Number(e.target.value))}
                  className="w-full pl-3 pr-8 py-2.5 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-purple-900/30"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 font-bold">
                  %
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 mt-1">Default is 20% discount on retail saree catalog.</p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setApprovingRequest(null)}
                className="flex-1 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmApproval}
                disabled={processingId === approvingRequest.id}
                className="flex-1 py-2.5 rounded-xl bg-purple-900 hover:bg-purple-800 text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
              >
                {processingId === approvingRequest.id ? 'Granting...' : 'Confirm & Grant Access'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Decline Request */}
      {decliningRequest && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-neutral-200 space-y-4 animate-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="w-9 h-9 rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center">
                  <XCircle className="w-5 h-5" />
                </span>
                <h3 className="font-serif text-lg font-bold text-neutral-900">
                  Decline Access Request
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDecliningRequest(null)}
                className="text-neutral-400 hover:text-neutral-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-neutral-600">
              Decline reseller application for <strong>{decliningRequest.email}</strong>? They will not be granted access to the wholesale portal.
            </p>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1">
                Internal Reason (Optional)
              </label>
              <input
                type="text"
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="e.g. Unverified phone number, duplicate request"
                className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDecliningRequest(null)}
                className="flex-1 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDecline}
                disabled={processingId === decliningRequest.id}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
              >
                {processingId === decliningRequest.id ? 'Declining...' : 'Confirm Decline'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Manual Add Reseller Partner */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-neutral-200 space-y-4 my-8 animate-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-serif text-xl font-bold text-neutral-900">
                  Add Reseller Partner
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Directly provision a B2B partner account in the 'reseller' collection.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {addModalError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{addModalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateManualPartner} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1">
                  Partner Email ID *
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="reseller@example.com"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs sm:text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-900/30"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1">
                    Contact Person Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    placeholder="Proprietor Name"
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs sm:text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-900/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1">
                    Business Name
                  </label>
                  <input
                    type="text"
                    value={newBusinessName}
                    onChange={(e) => setNewBusinessName(e.target.value)}
                    placeholder="e.g. Saree Haven"
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs sm:text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-900/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1">
                    WhatsApp Number *
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={newWhatsapp}
                    onChange={(e) => setNewWhatsapp(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="10-digit mobile"
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs sm:text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-900/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1">
                    City / Location
                  </label>
                  <input
                    type="text"
                    value={newCity}
                    onChange={(e) => setNewCity(e.target.value)}
                    placeholder="e.g. Salem, Madurai"
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs sm:text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-900/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1">
                    GST or PAN
                  </label>
                  <input
                    type="text"
                    value={newGst}
                    onChange={(e) => setNewGst(e.target.value)}
                    placeholder="33AAAAA0000A1Z5"
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs sm:text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-900/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1">
                    Wholesale Discount (%)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={50}
                    value={newMarginPercent}
                    onChange={(e) => setNewMarginPercent(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs sm:text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-900/30"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNew}
                  className="flex-1 py-2.5 rounded-xl bg-purple-900 hover:bg-purple-800 text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingNew ? 'Saving Partner...' : 'Save to Reseller Ledger'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirm Remove Reseller & Block Login */}
      {resellerToRemove && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-neutral-200 space-y-4 animate-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5" />
                </span>
                <h3 className="font-serif text-lg font-bold text-neutral-900 mt-2">
                  Remove Reseller Partner
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setResellerToRemove(null)}
                className="text-neutral-400 hover:text-neutral-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-1.5">
              <p className="text-xs font-bold text-neutral-900">
                {resellerToRemove.businessName || resellerToRemove.name}
              </p>
              <p className="text-xs text-neutral-600">
                Contact: <span className="font-medium text-neutral-900">{resellerToRemove.name}</span> •{' '}
                <span className="font-mono text-purple-900 font-bold">{resellerToRemove.email}</span>
              </p>
              <p className="text-[11px] text-neutral-500 font-mono">
                WhatsApp: {resellerToRemove.whatsappNumber}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-1">
              <p className="font-bold flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>Portal Access Will Be Permanently Revoked</span>
              </p>
              <p className="text-[11px] text-rose-700 leading-relaxed">
                This partner will be permanently deleted from the database <code className="bg-rose-100 px-1 py-0.5 rounded font-mono">reseller</code> collection. Any active login session will be immediately terminated, and this Google account will no longer be authorized to sign in.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResellerToRemove(null)}
                className="flex-1 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={processingId === resellerToRemove.id}
                onClick={handleConfirmRemoveReseller}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
              >
                {processingId === resellerToRemove.id ? 'Removing...' : 'Confirm Remove & Block'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
