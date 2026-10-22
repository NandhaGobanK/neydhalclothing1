import { StoreSettings, Order } from '../types/store';

/**
 * DisputeRedressalDefinition defines a single dispute or redressal option.
 * Extensible architecture: Any future redressals can simply be added to DISPUTE_REDRESSALS.
 */
export interface DisputeRedressalDefinition {
  id: string; // unique identifier
  type: 'delivery' | 'refund' | string;
  title: string;
  shortLabel: string;
  badgeLabel: string;
  description: string;
  iconType: 'truck' | 'refund' | 'alert' | 'shield';
  defaultNote: (orderNumber: string, status: string) => string;
  isEnabled: (settings?: StoreSettings) => boolean;
  /**
   * Order-Specific Status Gate Rule:
   * Delivery Dispute: only after order status is 'Delivered'
   * Refund Dispute: only after order is marked Cancelled/Rejected AND updated with Refunded status
   */
  isEligibleForOrder: (order: Order, settings?: StoreSettings) => boolean;
}

/**
 * Master Registry of dispute redressal mechanisms in the store.
 */
export const DISPUTE_REDRESSALS: DisputeRedressalDefinition[] = [
  {
    id: 'delivery',
    type: 'delivery',
    title: 'Customer Delivery Issue Reporting',
    shortLabel: 'Delivery Dispute',
    badgeLabel: 'Non-Delivery',
    description: 'Parcel marked delivered but not received, carrier transit delay, or missing parcel.',
    iconType: 'truck',
    defaultNote: (orderNumber: string, status: string) =>
      `Courier tracking shows ${status}, but I have not received this parcel at my address for order #${orderNumber}.`,
    isEnabled: (settings) => settings?.storefrontDisplay?.allowCustomerDeliveryDisputes !== false,
    // Delivery Issue Report option must appear in the "Report Issue" dropdown menu ONLY after order status is Delivered.
    // If order is not yet marked as delivered, this option must remain hidden.
    isEligibleForOrder: (order, settings) => {
      if (settings?.storefrontDisplay?.allowCustomerDeliveryDisputes === false) return false;
      const orderStage = (order.status || '').trim().toLowerCase();
      return orderStage === 'delivered';
    },
  },
  {
    id: 'refund',
    type: 'refund',
    title: 'Customer Refund Issue Reporting',
    shortLabel: 'Refund Inquiry',
    badgeLabel: 'Refund Inquiry',
    description: 'Payment settlement query, missing bank transfer, or UTR verification inquiry.',
    iconType: 'refund',
    defaultNote: (orderNumber: string) =>
      `I have an inquiry regarding my refund settlement for order #${orderNumber}.`,
    isEnabled: (settings) => {
      if (settings?.storefrontDisplay?.allowPublicRefunds === false) {
        return false;
      }
      return settings?.storefrontDisplay?.allowCustomerRefundDisputes !== false;
    },
    // Refund Dispute Report option must appear ONLY after order has been officially marked as Cancelled/Rejected
    // and updated with a Refunded status on the customer's order.
    // If this status condition is not met, the refund dispute option must remain hidden.
    isEligibleForOrder: (order, settings) => {
      if (settings?.storefrontDisplay?.allowPublicRefunds === false) return false;
      if (settings?.storefrontDisplay?.allowCustomerRefundDisputes === false) return false;

      const orderStage = (order.status || '').trim().toLowerCase();
      const refundTxStatus = (order.refundDetails?.refundStatus || '').trim().toLowerCase();
      const hasRefundUtr = Boolean(order.refundDetails?.refundUtr && order.refundDetails.refundUtr.trim());

      // Rule: Check that the order is officially marked as Cancelled / Rejected or moved to Refunded status
      const isCancelledOrRefunded =
        orderStage === 'cancelled' ||
        orderStage === 'rejected' ||
        orderStage === 'refunded' ||
        refundTxStatus === 'processed' ||
        refundTxStatus === 'pending' ||
        refundTxStatus === 'completed' ||
        hasRefundUtr ||
        Boolean(order.cancellationReason) ||
        Boolean(order.cancellationRequest?.requested) ||
        Boolean(
          order.statusHistory?.some((h) => {
            const hs = (h.status || '').trim().toLowerCase();
            return hs === 'cancelled' || hs === 'rejected' || hs === 'refunded';
          })
        );

      return isCancelledOrRefunded;
    },
  },
];

/**
 * Returns an array of all dispute redressal mechanisms that are actively enabled
 * by the store administrator in settings.
 */
export function getActiveDisputeRedressals(settings?: StoreSettings): DisputeRedressalDefinition[] {
  if (!settings) return [];
  return DISPUTE_REDRESSALS.filter((redressal) => redressal.isEnabled(settings));
}

/**
 * Returns only the dispute redressal options that are eligible for this specific order based on:
 * 1. Store settings
 * 2. Order status conditions:
 *    - Delivery Issue: ONLY after status is 'Delivered'
 *    - Refund Dispute: ONLY after officially marked 'Cancelled' AND updated with 'Refunded' status
 */
export function getOrderEligibleRedressals(order: Order, settings?: StoreSettings): DisputeRedressalDefinition[] {
  if (!order) return [];
  return DISPUTE_REDRESSALS.filter((r) => r.isEligibleForOrder(order, settings));
}

/**
 * Checks if a specific redressal type is currently enabled in settings.
 */
export function isDisputeRedressalEnabled(type: string, settings?: StoreSettings): boolean {
  const match = DISPUTE_REDRESSALS.find((r) => r.type === type || r.id === type);
  if (!match) return false;
  return match.isEnabled(settings);
}

/**
 * Conditional Visibility Rule:
 * Returns TRUE if and only if at least ONE dispute redressal option is actively enabled for this order.
 * If none of the dispute options match the order's current status condition, returns FALSE,
 * completely hiding the "Report Issue" button for this order.
 */
export function isCustomerReportIssueVisibleForOrder(order: Order, settings?: StoreSettings): boolean {
  if (!order) return false;
  return getOrderEligibleRedressals(order, settings).length > 0;
}

export function isCustomerReportIssueVisible(settings?: StoreSettings): boolean {
  return getActiveDisputeRedressals(settings).length > 0;
}
