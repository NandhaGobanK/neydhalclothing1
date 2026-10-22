import { Order, StaffMember } from '../types/store';

export interface StaffPerformanceDetail {
  id: string;
  name: string;
  username: string;
  role: string;
  totalOrders: number;
  deliveredOrders: number;
  closedOrders: number;
  totalRevenue: number;

  // 1. Fastest Order Closer Metrics
  avgCompletionHours: number | null; // null if no orders delivered yet
  fastestCompletionHours: number | null;
  fastestCompletedOrderNumber?: string;
  completionCount: number;

  // 2. Fastest Assigner Metrics
  avgAssignmentMinutes: number | null; // null if no claim/assignment data
  fastestAssignmentMinutes: number | null;
  fastestAssignedOrderNumber?: string;
  totalAssignedCount: number;

  // 3. Fastest Dispute Resolver Metrics
  avgDisputeResolutionHours: number | null;
  fastestDisputeResolutionHours: number | null;
  disputesResolvedCount: number;
  disputesInvestigatingCount: number;
  totalInvestigationComments: number;

  // Badges & Accolades
  isFastestCloser?: boolean;
  isFastestAssigner?: boolean;
  isFastestDisputeResolver?: boolean;
  isTopRevenue?: boolean;
  isAllRounderStar?: boolean;
  compositeScore: number;
}

export interface PerformanceSummaryWinners {
  fastestCloser?: StaffPerformanceDetail;
  fastestAssigner?: StaffPerformanceDetail;
  fastestDisputeResolver?: StaffPerformanceDetail;
  allRounderStar?: StaffPerformanceDetail;
  topVolumeLeader?: StaffPerformanceDetail;
}

export function formatDurationHours(hours: number | null): string {
  if (hours === null || isNaN(hours) || hours <= 0) return 'N/A';
  if (hours < 1) {
    const mins = Math.max(1, Math.round(hours * 60));
    return `${mins} min${mins === 1 ? '' : 's'}`;
  }
  if (hours < 24) {
    return `${hours.toFixed(1)} hrs`;
  }
  const days = hours / 24;
  return `${days.toFixed(1)} day${days >= 2 ? 's' : ''}`;
}

export function formatDurationMinutes(minutes: number | null): string {
  if (minutes === null || isNaN(minutes) || minutes <= 0) return 'N/A';
  if (minutes < 60) {
    return `${Math.round(minutes)} min${Math.round(minutes) === 1 ? '' : 's'}`;
  }
  const hours = minutes / 60;
  if (hours < 24) {
    return `${hours.toFixed(1)} hrs`;
  }
  const days = hours / 24;
  return `${days.toFixed(1)} days`;
}

export function calculateStaffPerformance(
  orders: Order[],
  staffMembers: StaffMember[]
): {
  performanceList: StaffPerformanceDetail[];
  winners: PerformanceSummaryWinners;
} {
  // Aggregate accounts: all configured staff + store owner (admin)
  const allStaff: Array<{ id: string; name: string; username: string; role: string }> = [
    {
      id: 'admin',
      name: 'Store Owner',
      username: 'admin',
      role: 'Store Owner / Admin',
    },
    ...staffMembers.map((s) => ({
      id: s.id,
      name: s.name,
      username: s.username,
      role: s.role,
    })),
  ];

  const performanceList: StaffPerformanceDetail[] = allStaff.map((staff) => {
    // Orders assigned to this staff member
    const assignedOrders = orders.filter((o) => o.assignedStaffId === staff.id);
    const totalOrders = assignedOrders.length;
    const deliveredOrders = assignedOrders.filter((o) => o.status === 'Delivered').length;
    const closedOrders = assignedOrders.filter((o) => Boolean(o.isClosed)).length;
    // Realized revenue strictly from Delivered & Closed orders; deducts processed refunds or refund disputes in real time
    const totalRevenue = assignedOrders
      .filter(
        (o) =>
          o.status === 'Delivered' &&
          Boolean(o.isClosed) &&
          o.refundDetails?.refundStatus !== 'processed' &&
          !(Boolean(o.deliveryIssue?.reported) && o.deliveryIssue?.issueType === 'refund')
      )
      .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    // 1. Calculate Order Completion Speeds
    const completionDurations: Array<{ hours: number; orderNumber: string }> = [];
    assignedOrders.forEach((o) => {
      const completionTimeStr = o.deliveredAt || o.completedAt || o.closedAt;
      if (completionTimeStr && (o.status === 'Delivered' || o.isClosed)) {
        const createdMs = new Date(o.createdAt).getTime();
        const completedMs = new Date(completionTimeStr).getTime();
        if (completedMs > createdMs) {
          const diffHours = (completedMs - createdMs) / (1000 * 60 * 60);
          if (diffHours >= 0.05 && diffHours < 1000) {
            completionDurations.push({ hours: diffHours, orderNumber: o.orderNumber });
          }
        }
      }
    });

    let avgCompletionHours: number | null = null;
    let fastestCompletionHours: number | null = null;
    let fastestCompletedOrderNumber: string | undefined = undefined;

    if (completionDurations.length > 0) {
      const sum = completionDurations.reduce((acc, c) => acc + c.hours, 0);
      avgCompletionHours = sum / completionDurations.length;
      completionDurations.sort((a, b) => a.hours - b.hours);
      fastestCompletionHours = completionDurations[0].hours;
      fastestCompletedOrderNumber = completionDurations[0].orderNumber;
    }

    // 2. Calculate Order & Dispute Claim / Assignment Speeds
    // Check orders assigned to this staff, or orders assigned BY this staff in history
    const assignmentDurations: Array<{ minutes: number; orderNumber: string }> = [];
    orders.forEach((o) => {
      // Direct assignedAt timestamp
      if (o.assignedStaffId === staff.id) {
        const assignedTimeStr = o.assignedAt || o.claimedAt;
        if (assignedTimeStr) {
          const createdMs = new Date(o.createdAt).getTime();
          const assignedMs = new Date(assignedTimeStr).getTime();
          if (assignedMs >= createdMs) {
            const diffMins = (assignedMs - createdMs) / (1000 * 60);
            if (diffMins >= 0.1 && diffMins < 10000) {
              assignmentDurations.push({ minutes: diffMins, orderNumber: o.orderNumber });
            }
          }
        }
      }

      // Also inspect history logs where this staff claimed/assigned an order or dispute
      (o.assignmentHistory || []).forEach((h) => {
        if (
          h.staffId === staff.id ||
          (h.assignedBy && h.assignedBy.toLowerCase().includes(staff.name.toLowerCase()))
        ) {
          if (
            h.action.toLowerCase().includes('assign') ||
            h.action.toLowerCase().includes('claim')
          ) {
            const createdMs = new Date(o.createdAt).getTime();
            const logMs = new Date(h.timestamp).getTime();
            if (logMs >= createdMs) {
              const diffMins = (logMs - createdMs) / (1000 * 60);
              if (diffMins >= 0.1 && diffMins < 10000) {
                assignmentDurations.push({ minutes: diffMins, orderNumber: o.orderNumber });
              }
            }
          }
        }
      });
    });

    let avgAssignmentMinutes: number | null = null;
    let fastestAssignmentMinutes: number | null = null;
    let fastestAssignedOrderNumber: string | undefined = undefined;

    if (assignmentDurations.length > 0) {
      const sum = assignmentDurations.reduce((acc, a) => acc + a.minutes, 0);
      avgAssignmentMinutes = sum / assignmentDurations.length;
      assignmentDurations.sort((a, b) => a.minutes - b.minutes);
      fastestAssignmentMinutes = assignmentDurations[0].minutes;
      fastestAssignedOrderNumber = assignmentDurations[0].orderNumber;
    }

    // 3. Calculate Dispute Resolution Speeds & Investigation Activity
    const disputeResolutionDurations: Array<{ hours: number; orderNumber: string }> = [];
    let disputesResolvedCount = 0;
    let disputesInvestigatingCount = 0;
    let totalInvestigationComments = 0;

    orders.forEach((o) => {
      if (o.deliveryIssue?.reported) {
        const isHandledByStaff =
          o.assignedStaffId === staff.id ||
          o.disputeResolvedBy?.toLowerCase().includes(staff.name.toLowerCase()) ||
          o.deliveryIssue.resolvedBy?.toLowerCase().includes(staff.name.toLowerCase());

        // Count investigation comments by this staff
        const staffComments = (o.deliveryIssue.investigationComments || []).filter(
          (c) =>
            c.authorId === staff.id ||
            c.author.toLowerCase().includes(staff.name.toLowerCase())
        );
        totalInvestigationComments += staffComments.length;

        if (isHandledByStaff || staffComments.length > 0) {
          if (o.deliveryIssue.status === 'investigating') {
            disputesInvestigatingCount++;
          }
          if (o.deliveryIssue.status === 'resolved') {
            disputesResolvedCount++;
            const reportMs = new Date(o.deliveryIssue.reportedAt).getTime();
            const resolveMs = new Date(
              o.disputeResolvedAt || o.deliveryIssue.resolvedAt || o.createdAt
            ).getTime();
            if (resolveMs >= reportMs) {
              const diffHours = (resolveMs - reportMs) / (1000 * 60 * 60);
              if (diffHours >= 0.05 && diffHours < 1000) {
                disputeResolutionDurations.push({ hours: diffHours, orderNumber: o.orderNumber });
              }
            }
          }
        }
      }
    });

    let avgDisputeResolutionHours: number | null = null;
    let fastestDisputeResolutionHours: number | null = null;

    if (disputeResolutionDurations.length > 0) {
      const sum = disputeResolutionDurations.reduce((acc, d) => acc + d.hours, 0);
      avgDisputeResolutionHours = sum / disputeResolutionDurations.length;
      disputeResolutionDurations.sort((a, b) => a.hours - b.hours);
      fastestDisputeResolutionHours = disputeResolutionDurations[0].hours;
    }

    // Composite Performance Score (weighted holistic efficiency)
    // - Orders closed: 15 pts each
    // - Delivered orders: 10 pts each
    // - Speed bonus for fast closers (< 24 hrs): 20 pts
    // - Speed bonus for fast assigners (< 30 mins): 15 pts
    // - Disputes resolved: 25 pts each
    // - Fast dispute resolution (< 6 hrs): 20 pts
    // - Investigation comments logged: 5 pts each
    let compositeScore =
      closedOrders * 15 +
      deliveredOrders * 10 +
      disputesResolvedCount * 25 +
      totalInvestigationComments * 5;

    if (avgCompletionHours !== null && avgCompletionHours < 24) compositeScore += 20;
    if (avgAssignmentMinutes !== null && avgAssignmentMinutes < 30) compositeScore += 15;
    if (avgDisputeResolutionHours !== null && avgDisputeResolutionHours < 6) compositeScore += 20;

    return {
      id: staff.id,
      name: staff.name,
      username: staff.username,
      role: staff.role,
      totalOrders,
      deliveredOrders,
      closedOrders,
      totalRevenue,
      avgCompletionHours,
      fastestCompletionHours,
      fastestCompletedOrderNumber,
      completionCount: completionDurations.length,
      avgAssignmentMinutes,
      fastestAssignmentMinutes,
      fastestAssignedOrderNumber,
      totalAssignedCount: assignmentDurations.length,
      avgDisputeResolutionHours,
      fastestDisputeResolutionHours,
      disputesResolvedCount,
      disputesInvestigatingCount,
      totalInvestigationComments,
      compositeScore,
    };
  });

  // Determine Award Winners
  // 1. Fastest Order Closer (must have at least 1 completed order)
  const closers = performanceList.filter((s) => s.avgCompletionHours !== null && s.completionCount > 0);
  closers.sort((a, b) => (a.avgCompletionHours || 9999) - (b.avgCompletionHours || 9999));
  const fastestCloser = closers[0];
  if (fastestCloser) fastestCloser.isFastestCloser = true;

  // 2. Fastest Assigner (must have claimed/assigned at least 1 order)
  const assigners = performanceList.filter((s) => s.avgAssignmentMinutes !== null && s.totalAssignedCount > 0);
  assigners.sort((a, b) => (a.avgAssignmentMinutes || 9999) - (b.avgAssignmentMinutes || 9999));
  const fastestAssigner = assigners[0];
  if (fastestAssigner) fastestAssigner.isFastestAssigner = true;

  // 3. Fastest Dispute Resolver (disputes resolved or high investigation activity)
  const resolvers = performanceList.filter(
    (s) => s.disputesResolvedCount > 0 || s.totalInvestigationComments > 0
  );
  resolvers.sort((a, b) => {
    if (b.disputesResolvedCount !== a.disputesResolvedCount) {
      return b.disputesResolvedCount - a.disputesResolvedCount;
    }
    const aSpeed = a.avgDisputeResolutionHours ?? 9999;
    const bSpeed = b.avgDisputeResolutionHours ?? 9999;
    return aSpeed - bSpeed;
  });
  const fastestDisputeResolver = resolvers[0];
  if (fastestDisputeResolver) fastestDisputeResolver.isFastestDisputeResolver = true;

  // 4. Top Volume Leader
  const volumeSorted = [...performanceList].sort((a, b) => b.totalOrders - a.totalOrders);
  const topVolumeLeader = volumeSorted[0];

  // 5. All-Rounder Star (top composite score)
  const compositeSorted = [...performanceList].sort((a, b) => b.compositeScore - a.compositeScore);
  const allRounderStar = compositeSorted[0];
  if (allRounderStar) allRounderStar.isAllRounderStar = true;

  return {
    performanceList: compositeSorted,
    winners: {
      fastestCloser,
      fastestAssigner,
      fastestDisputeResolver,
      allRounderStar,
      topVolumeLeader,
    },
  };
}
