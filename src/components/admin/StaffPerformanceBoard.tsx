import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import {
  calculateStaffPerformance,
  formatDurationHours,
  formatDurationMinutes,
  StaffPerformanceDetail,
} from '../../utils/staffPerformance';
import { formatPrice } from '../../utils/upi';
import {
  Crown,
  Zap,
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Award,
  ArrowRight,
  Download,
  X,
  User,
  Sparkles,
} from 'lucide-react';

interface StaffPerformanceBoardProps {
  onClose?: () => void;
  onSelectStaffBucket?: (staffId: string) => void;
  onExportCsv?: () => void;
}

export const StaffPerformanceBoard: React.FC<StaffPerformanceBoardProps> = ({
  onClose,
  onSelectStaffBucket,
  onExportCsv,
}) => {
  const { orders, staffMembers, currentUser } = useStore();
  const isAdmin = currentUser?.type === 'admin';

  const [activeCategoryTab, setActiveCategoryTab] = useState<
    'all' | 'closers' | 'assigners' | 'disputes'
  >('all');

  const { performanceList, winners } = useMemo(() => {
    return calculateStaffPerformance(orders, staffMembers);
  }, [orders, staffMembers]);

  // Filter or sort depending on selected tab
  const displayedList = useMemo(() => {
    const list = [...performanceList];
    if (activeCategoryTab === 'closers') {
      return list.sort((a, b) => {
        const aVal = a.avgCompletionHours ?? 9999;
        const bVal = b.avgCompletionHours ?? 9999;
        return aVal - bVal;
      });
    }
    if (activeCategoryTab === 'assigners') {
      return list.sort((a, b) => {
        const aVal = a.avgAssignmentMinutes ?? 9999;
        const bVal = b.avgAssignmentMinutes ?? 9999;
        return aVal - bVal;
      });
    }
    if (activeCategoryTab === 'disputes') {
      return list.sort((a, b) => {
        if (b.disputesResolvedCount !== a.disputesResolvedCount) {
          return b.disputesResolvedCount - a.disputesResolvedCount;
        }
        const aVal = a.avgDisputeResolutionHours ?? 9999;
        const bVal = b.avgDisputeResolutionHours ?? 9999;
        return aVal - bVal;
      });
    }
    return list; // 'all' (sorted by composite score)
  }, [performanceList, activeCategoryTab]);

  return (
    <div className="p-4 sm:p-6 rounded-3xl bg-gradient-to-br from-amber-500/10 via-white to-amber-50/40 border-2 border-amber-400/60 shadow-xl space-y-6 animate-in fade-in slide-in-from-top-2">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-200/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-amber-500 text-neutral-950 font-bold shrink-0 shadow-xs">
            <Crown className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-serif text-lg sm:text-xl font-bold text-neutral-950">
                Staff Workload, Performance & Appreciation Board
              </h3>
              <span className="text-[10px] font-sans px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-bold uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-600" />
                <span>Multi-Factor Metrics</span>
              </span>
            </div>
            <p className="text-xs text-neutral-600 mt-0.5">
              Comprehensive operational appraisal honoring response speed, customer dispute resolution, order closer efficiency, and boutique sales attribution.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
          {onExportCsv && (
            <button
              type="button"
              onClick={onExportCsv}
              className="px-3.5 py-1.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Download full staff workload & speed metrics CSV"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Export CSV</span>
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-neutral-500 hover:text-neutral-900 hover:bg-amber-100/60 transition cursor-pointer"
              title="Close board"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Top 4 Special Accolade Winner Banners (Fastest Closer, Fastest Assigner, Fastest Resolver, Star All-Rounder) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* 1. Fastest Order Closer */}
        <div className="p-4 rounded-2xl bg-white border-2 border-emerald-400/80 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-emerald-100/60 rounded-full pointer-events-none" />
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3 h-3 text-emerald-700" />
                <span>Fastest Order Closer</span>
              </span>
              <span className="text-emerald-600 font-bold text-xs">🏆 Speed</span>
            </div>
            {winners.fastestCloser ? (
              <div className="space-y-1">
                <p className="font-serif font-bold text-base text-neutral-900">
                  {winners.fastestCloser.name}
                </p>
                <p className="text-xs text-neutral-600 font-medium">
                  Avg completion:{' '}
                  <strong className="text-emerald-700 font-bold">
                    {formatDurationHours(winners.fastestCloser.avgCompletionHours)}
                  </strong>
                </p>
                {winners.fastestCloser.fastestCompletionHours !== null && (
                  <p className="text-[11px] text-neutral-500">
                    Fastest deal:{' '}
                    <span className="font-mono font-semibold text-neutral-700">
                      {formatDurationHours(winners.fastestCloser.fastestCompletionHours)}
                    </span>{' '}
                    {winners.fastestCloser.fastestCompletedOrderNumber && (
                      <span className="text-neutral-400">
                        (#{winners.fastestCloser.fastestCompletedOrderNumber})
                      </span>
                    )}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-neutral-400 italic">No orders completed yet</p>
            )}
          </div>
          <div className="mt-2 pt-2 border-t border-emerald-100 text-[10px] text-emerald-800 font-semibold flex items-center justify-between">
            <span>Delivered & Closed:</span>
            <span>
              {winners.fastestCloser?.deliveredOrders || 0} orders
            </span>
          </div>
        </div>

        {/* 2. Fastest Assigner */}
        <div className="p-4 rounded-2xl bg-white border-2 border-amber-400/80 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-amber-100/60 rounded-full pointer-events-none" />
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-700 fill-amber-500" />
                <span>Fastest Assigner</span>
              </span>
              <span className="text-amber-600 font-bold text-xs">⚡ Dispatch</span>
            </div>
            {winners.fastestAssigner ? (
              <div className="space-y-1">
                <p className="font-serif font-bold text-base text-neutral-900">
                  {winners.fastestAssigner.name}
                </p>
                <p className="text-xs text-neutral-600 font-medium">
                  Avg intake speed:{' '}
                  <strong className="text-amber-800 font-bold">
                    {formatDurationMinutes(winners.fastestAssigner.avgAssignmentMinutes)}
                  </strong>
                </p>
                {winners.fastestAssigner.fastestAssignmentMinutes !== null && (
                  <p className="text-[11px] text-neutral-500">
                    Fastest claim:{' '}
                    <span className="font-mono font-semibold text-neutral-700">
                      {formatDurationMinutes(winners.fastestAssigner.fastestAssignmentMinutes)}
                    </span>
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-neutral-400 italic">No assigned orders logged</p>
            )}
          </div>
          <div className="mt-2 pt-2 border-t border-amber-100 text-[10px] text-amber-800 font-semibold flex items-center justify-between">
            <span>Queue Intake:</span>
            <span>
              {winners.fastestAssigner?.totalAssignedCount || 0} claims
            </span>
          </div>
        </div>

        {/* 3. Fastest Dispute Resolver */}
        <div className="p-4 rounded-2xl bg-white border-2 border-rose-400/80 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-rose-100/60 rounded-full pointer-events-none" />
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-900 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-rose-700" />
                <span>Fastest Dispute Resolver</span>
              </span>
              <span className="text-rose-600 font-bold text-xs">🛡️ Concierge</span>
            </div>
            {winners.fastestDisputeResolver ? (
              <div className="space-y-1">
                <p className="font-serif font-bold text-base text-neutral-900">
                  {winners.fastestDisputeResolver.name}
                </p>
                <p className="text-xs text-neutral-600 font-medium">
                  Disputes Resolved:{' '}
                  <strong className="text-rose-700 font-bold">
                    {winners.fastestDisputeResolver.disputesResolvedCount} cases
                  </strong>
                </p>
                <p className="text-[11px] text-neutral-500">
                  Investigation notes logged:{' '}
                  <span className="font-bold text-neutral-700">
                    {winners.fastestDisputeResolver.totalInvestigationComments}
                  </span>
                </p>
              </div>
            ) : (
              <p className="text-xs text-neutral-400 italic">No delivery disputes reported</p>
            )}
          </div>
          <div className="mt-2 pt-2 border-t border-rose-100 text-[10px] text-rose-800 font-semibold flex items-center justify-between">
            <span>Resolution Speed:</span>
            <span>
              {formatDurationHours(winners.fastestDisputeResolver?.avgDisputeResolutionHours ?? null)}
            </span>
          </div>
        </div>

        {/* 4. All-Rounder Star */}
        <div className="p-4 rounded-2xl bg-white border-2 border-amber-500 shadow-sm relative overflow-hidden flex flex-col justify-between ring-2 ring-amber-300">
          <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-amber-200/50 rounded-full pointer-events-none" />
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="px-2 py-0.5 rounded-md bg-amber-500 text-neutral-950 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1 shadow-xs">
                <Crown className="w-3 h-3 fill-neutral-950" />
                <span>Star All-Rounder</span>
              </span>
              <span className="text-amber-700 font-bold text-xs">★ Composite</span>
            </div>
            {winners.allRounderStar ? (
              <div className="space-y-1">
                <p className="font-serif font-bold text-base text-neutral-900">
                  {winners.allRounderStar.name}
                </p>
                <p className="text-xs text-neutral-600">
                  Total Orders Handled:{' '}
                  <strong className="text-neutral-950 font-bold">
                    {winners.allRounderStar.totalOrders}
                  </strong>
                </p>
                <p className="text-[11px] text-neutral-500 font-medium">
                  Realized Sales (Closed):{' '}
                  <strong className="text-amber-900 font-serif font-bold">
                    {formatPrice(winners.allRounderStar.totalRevenue)}
                  </strong>
                </p>
              </div>
            ) : (
              <p className="text-xs text-neutral-400 italic">Calculating team leader</p>
            )}
          </div>
          <div className="mt-2 pt-2 border-t border-amber-200 text-[10px] text-neutral-800 font-bold flex items-center justify-between">
            <span>Performance Score:</span>
            <span className="text-amber-800 font-extrabold">
              {winners.allRounderStar?.compositeScore || 0} pts
            </span>
          </div>
        </div>
      </div>

      {/* Category Tab Filters */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-neutral-200">
        {[
          { id: 'all', label: 'Overall Composite Ranking', icon: Crown },
          { id: 'closers', label: 'Fastest Order Closers', icon: Clock },
          { id: 'assigners', label: 'Fastest Assigners', icon: Zap },
          { id: 'disputes', label: 'Dispute Resolvers', icon: ShieldCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeCategoryTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveCategoryTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer ${
                isActive
                  ? 'bg-neutral-950 text-white shadow-xs'
                  : 'bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400' : 'text-neutral-500'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Detailed Per-Staff Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {displayedList.map((item, idx) => {
          const isTop = idx === 0;
          const isMe = currentUser?.staffId === item.id || (isAdmin && item.id === 'admin');

          return (
            <div
              key={item.id}
              className={`p-4 rounded-2xl border transition relative flex flex-col justify-between ${
                isTop
                  ? 'bg-amber-50/90 border-amber-400 shadow-sm ring-1 ring-amber-300'
                  : 'bg-white border-neutral-200 hover:border-neutral-300 shadow-2xs'
              }`}
            >
              {/* Top Rank Badge */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-neutral-950 text-amber-300 font-serif font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
                    {item.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="font-bold text-xs sm:text-sm text-neutral-900">{item.name}</h4>
                      {isMe && (
                        <span className="text-[10px] text-amber-700 font-bold bg-amber-100 px-1.5 py-0.2 rounded border border-amber-200">
                          You
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-neutral-500 font-mono">
                      @{item.username} · {item.role}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 border border-neutral-200">
                    Rank #{idx + 1}
                  </span>
                  {item.isFastestCloser && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold border border-emerald-300">
                      ⚡ Fastest Closer
                    </span>
                  )}
                  {item.isFastestAssigner && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 font-bold border border-amber-300">
                      ⚡ Quick Assigner
                    </span>
                  )}
                  {item.isFastestDisputeResolver && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 font-bold border border-rose-300">
                      🛡️ Top Resolver
                    </span>
                  )}
                </div>
              </div>

              {/* Performance Key Indicators Matrix */}
              <div className="space-y-2 py-2 border-y border-neutral-100 text-xs">
                {/* 1. Order Closer Speed */}
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-neutral-500 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-emerald-600" />
                    <span>Avg Order Completion:</span>
                  </span>
                  <span className="font-bold text-emerald-800 font-mono">
                    {formatDurationHours(item.avgCompletionHours)}
                  </span>
                </div>

                {/* 2. Assigner Speed */}
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-neutral-500 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-600" />
                    <span>Avg Claim / Assign:</span>
                  </span>
                  <span className="font-bold text-amber-800 font-mono">
                    {formatDurationMinutes(item.avgAssignmentMinutes)}
                  </span>
                </div>

                {/* 3. Dispute Resolution */}
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-neutral-500 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-rose-600" />
                    <span>Disputes Resolved:</span>
                  </span>
                  <span className="font-bold text-rose-800 font-mono">
                    {item.disputesResolvedCount} case{item.disputesResolvedCount === 1 ? '' : 's'}
                    {item.totalInvestigationComments > 0 && (
                      <span className="text-neutral-400 font-normal">
                        {' '}
                        ({item.totalInvestigationComments} notes)
                      </span>
                    )}
                  </span>
                </div>

                {/* Workload counts */}
                <div className="grid grid-cols-3 gap-1 pt-1 text-center text-[10px]">
                  <div className="p-1 rounded bg-neutral-50 border border-neutral-100">
                    <span className="text-neutral-400 block font-semibold">Total</span>
                    <strong className="text-neutral-900 font-mono">{item.totalOrders}</strong>
                  </div>
                  <div className="p-1 rounded bg-emerald-50 border border-emerald-100">
                    <span className="text-emerald-700 block font-semibold">Delivered</span>
                    <strong className="text-emerald-800 font-mono">{item.deliveredOrders}</strong>
                  </div>
                  <div className="p-1 rounded bg-neutral-100 border border-neutral-200">
                    <span className="text-neutral-600 block font-semibold">Closed</span>
                    <strong className="text-neutral-900 font-mono">{item.closedOrders}</strong>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1">
                  <span className="text-neutral-500">Realized Sales (Closed):</span>
                  <span className="font-bold text-neutral-900 font-serif">
                    {formatPrice(item.totalRevenue)}
                  </span>
                </div>
              </div>

              {/* Action Button */}
              {onSelectStaffBucket && (
                <div className="mt-3 pt-1">
                  <button
                    type="button"
                    onClick={() => onSelectStaffBucket(item.id)}
                    className="w-full py-2 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <span>View {item.name.split(' ')[0]}'s Dedicated Bucket</span>
                    <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
