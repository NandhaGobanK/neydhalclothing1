import { StoreSettings } from '../types/store';

/**
 * DisputeRedressalDefinition defines a single dispute or redressal option.
 * Extensible architecture: Any future redressals (e.g., damaged transit, wrong variant,
 * fabric exchange, weaver defect) can simply be added to DISPUTE_REDRESSALS.
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
}

/**
 * Master Registry of dispute redressal mechanisms in the store.
 * Extensible for future redressals: Any new redressal added here automatically participates
 * in dynamic visibility checks, category dropdown menus, and customer issue routing.
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
    isEnabled: (settings) => settings?.storefrontDisplay?.allowCustomerRefundDisputes !== false,
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
 * Checks if a specific redressal type is currently enabled.
 */
export function isDisputeRedressalEnabled(type: string, settings?: StoreSettings): boolean {
  const match = DISPUTE_REDRESSALS.find((r) => r.type === type || r.id === type);
  if (!match) return false;
  return match.isEnabled(settings);
}

/**
 * Conditional Visibility Rule:
 * Returns TRUE if and only if at least ONE dispute redressal option is actively enabled.
 * If ALL individual dispute options (e.g. delivery, refund, and any future ones) are disabled,
 * this returns FALSE, completely hiding the main "Report Issue" button on the customer-facing front.
 */
export function isCustomerReportIssueVisible(settings?: StoreSettings): boolean {
  return getActiveDisputeRedressals(settings).length > 0;
}
